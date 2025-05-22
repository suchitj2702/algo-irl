import { NextRequest, NextResponse } from 'next/server';
import { orchestrateJudge0Submission } from '../../../lib/code-execution/codeExecution';
import judge0Config from '../../../lib/code-execution/judge0Config';
import { Judge0Client } from '../../../lib/code-execution/judge0Client';
import { createCodeSubmission } from '../../../lib/code-execution/codeExecutionUtils';
import type { TestCase } from '../../../data-types/problem';
import { getProblemById } from '../../../lib/problem/problemDatastoreUtils';

// Initialize Judge0Client without the global callbackUrl, 
// as it's now handled per-batch by orchestrateJudge0Submission
const judge0Client = new Judge0Client({
  apiUrl: judge0Config.apiUrl,
  apiKey: judge0Config.apiKey,
});

export async function POST(request: NextRequest) {
  try {
    // Accept both legacy format and new problem-based format
    const { code, language, testCases, boilerplateCode } = await request.json();
    
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }
    if (!language || typeof language !== 'string') {
      return NextResponse.json({ error: 'Language is required' }, { status: 400 });
    }
    if (!boilerplateCode || typeof boilerplateCode !== 'string') {
      return NextResponse.json({ error: 'Boilerplate code is required' }, { status: 400 });
    }
    if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
      return NextResponse.json(
        { error: 'Test cases are required' }, 
        { status: 400 }
      );
    }

    // Use the updated orchestration function that supports both modes
    const submissionResult = await orchestrateJudge0Submission(judge0Client, {
      code,
      language,
      testCases: testCases as TestCase[],
      boilerplateCode, // Pass boilerplateCode directly
    });

    // Determine the test cases to store in Firestore
    let testCasesToStore: TestCase[] = [];
    if (testCases) {
      // If problemId is not provided, use the testCases from the request (legacy mode)
      // Apply the processing logic for nested arrays if needed (consider if this is still required)
      testCasesToStore = JSON.parse(JSON.stringify(testCases as TestCase[])).map((tc: TestCase) => {
        // Helper function to recursively process all nested arrays
        const processNestedArrays = (obj: any): any => {
          if (Array.isArray(obj)) {
            if (obj.some(item => Array.isArray(item))) {
              return JSON.stringify(obj);
            }
            return obj;
          } else if (obj && typeof obj === 'object') {
            const result: any = {};
            for (const key in obj) {
              result[key] = processNestedArrays(obj[key]);
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
    // If neither problemId nor testCases are provided, testCasesToStore remains [] (though input validation should prevent this)
    
    // Store submission details in Firestore
    await createCodeSubmission({
      id: submissionResult.internalSubmissionId,
      code,
      language,
      judge0Tokens: submissionResult.judge0Tokens.map((t: { token: string }) => t.token),
      status: 'pending', // Initial status
      testCases: testCasesToStore, // Use the correctly fetched or processed test cases
      // results will be populated by the callback or polling mechanism
    });
    
    // Respond to the client with the internal ID for polling
    return NextResponse.json({ 
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
      testCasesTotal: 0, // Can't reliably determine total now
      executionTime: null,
      memoryUsage: null,
      status: 'error' // Add a status field to the error response
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
} 