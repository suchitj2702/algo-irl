import { NextRequest } from 'next/server';
import { orchestrateJudge0Submission } from '../../../lib/code-execution/codeExecution';
import judge0Config from '../../../lib/code-execution/judge0Config';
import { Judge0Client } from '../../../lib/code-execution/judge0Client';
import { createCodeSubmission } from '../../../lib/code-execution/codeExecutionUtils';
import type { TestCase } from '../../../data-types/problem';
import { validateCodeSubmission, SecurityLimits } from '@/lib/security/validation';
import { withCors } from '@/lib/shared/apiResponse';
import { sanitizeInput } from '@/lib/security/input-sanitization';

// Initialize Judge0Client without the global callbackUrl,
// as it's now handled per-batch by orchestrateJudge0Submission
const judge0Client = new Judge0Client({
  apiUrl: judge0Config.apiUrl,
  apiKey: judge0Config.apiKey,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, language, testCases, boilerplateCode } = body;

    // Basic validation
    if (!code || typeof code !== 'string') {
      return withCors(request, { error: 'Code is required' }, { status: 400 });
    }

    if (!language || typeof language !== 'string') {
      return withCors(request, { error: 'Language is required' }, { status: 400 });
    }
    if (!boilerplateCode || typeof boilerplateCode !== 'string') {
      return withCors(request, { error: 'Boilerplate code is required' }, { status: 400 });
    }

    // Sanitize input strings (but preserve code structure for non-code fields)
    const sanitizedLanguage = sanitizeInput(language);
    // Note: We don't sanitize code or boilerplateCode as they need to preserve structure
    if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
      return withCors(request, { error: 'Test cases are required' }, { status: 400 });
    }

    // Validate code submission
    const validation = validateCodeSubmission(code, sanitizedLanguage);
    if (!validation.valid) {
      return withCors(request, { error: validation.error }, { status: 400 });
    }

    // Validate test cases count
    if (testCases.length > SecurityLimits.MAX_TEST_CASES) {
      return withCors(request, { error: `Maximum ${SecurityLimits.MAX_TEST_CASES} test cases allowed` }, { status: 400 });
    }

    // Add security constraints to Judge0 submission
    const secureSubmissionInput = {
      code,
      language,
      testCases: testCases as TestCase[],
      boilerplateCode,
      cpu_time_limit: SecurityLimits.MAX_EXECUTION_TIME_MS / 1000, // Convert to seconds
      memory_limit: SecurityLimits.MAX_MEMORY_MB * 1024, // Convert to KB
    };

    // Use the updated orchestration function that supports both modes
    const submissionResult = await orchestrateJudge0Submission(judge0Client, secureSubmissionInput);

    // Determine the test cases to store in Firestore
    let testCasesToStore: TestCase[] = [];
    if (testCases) {
      // If problemId is not provided, use the testCases from the request (legacy mode)
      // Apply the processing logic for nested arrays if needed (consider if this is still required)
      testCasesToStore = JSON.parse(JSON.stringify(testCases as TestCase[])).map((tc: TestCase) => {
        // Helper function to recursively process all nested arrays
        const processNestedArrays = (obj: unknown): unknown => {
          if (typeof obj === 'string') {
            return obj; // Return string as is if it's not a JSON string of an array/object
          }
          if (Array.isArray(obj)) {
            if (obj.some(item => Array.isArray(item) || (typeof item === 'object' && item !== null))) {
              return JSON.stringify(obj);
            }
            return obj;
          } else if (obj && typeof obj === 'object') {
            const result: Record<string, unknown> = {};
            for (const key in obj) {
              result[key] = processNestedArrays((obj as Record<string, unknown>)[key]);
            }
            return result;
          }
          return obj;
        };
        return {
          ...tc,
          stdin: processNestedArrays(tc.stdin),
          expectedStdout: processNestedArrays(tc.expectedStdout)
        };
      });
    }

    // Store submission with IP for tracking (Vercel provides IP in headers)
    const ip = request.headers.get('x-real-ip') ||
               request.headers.get('x-forwarded-for')?.split(',')[0] ||
               'unknown';
    await createCodeSubmission({
      id: submissionResult.internalSubmissionId,
      code,
      language,
      judge0Tokens: submissionResult.judge0Tokens.map((t: { token: string }) => t.token),
      status: 'pending',
      testCases: testCasesToStore,
      fingerprint: ip, // Use IP as fingerprint (Vercel provides this)
    });

    return withCors(request, {
      submissionId: submissionResult.internalSubmissionId,
      message: 'Code submitted successfully. Poll for results using the submissionId.'
    });

  } catch (error) {
    console.error('Code submission API error:', error);

    // Construct a generic error response structure
    const errorResponse = {
      error: error instanceof Error ? error.message : 'An unknown error occurred during submission.',
      passed: false,
      testCasesPassed: 0,
      testCasesTotal: 0,
      executionTime: null,
      memoryUsage: null,
      status: 'error'
    };
    return withCors(request, errorResponse, { status: 500 });
  }
}
