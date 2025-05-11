import { NextRequest, NextResponse } from 'next/server';
// import { v4 as uuidv4 } from 'uuid'; // No longer needed here, id generated in orchestrate
// import { prepareCodeForJudge0 } from '../../../lib/code-execution/codeExecution'; // Old method
import { orchestrateJudge0Submission } from '../../../lib/code-execution/codeExecution'; // New method - trying with .js extension
import judge0Config from '../../../lib/code-execution/judge0Config';
import { Judge0Client } from '../../../lib/code-execution/judge0Client';
import { createCodeSubmission } from '../../../lib/code-execution/codeExecutionUtils';
import type { TestCase } from '../../../data-types/problem';

// Initialize Judge0Client without the global callbackUrl, 
// as it's now handled per-batch by orchestrateJudge0Submission
const judge0Client = new Judge0Client({
  apiUrl: judge0Config.apiUrl,
  apiKey: judge0Config.apiKey,
});

export async function POST(request: NextRequest) {
  try {
    const { code, language, testCases } = await request.json();
    
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }
    if (!language || typeof language !== 'string') {
      return NextResponse.json({ error: 'Language is required' }, { status: 400 });
    }
    if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
      return NextResponse.json({ error: 'Test cases are required and must not be empty' }, { status: 400 });
    }
    
    // The old languageId check here is now handled inside orchestrateJudge0Submission via getDriverDetails

    // No more direct preparation or single token submission here
    // const { preparedCode, input } = prepareCodeForJudge0(code, language, testCases as TestCase[]);
    // const token = await judge0Client.submitCode(...);

    const submissionResult = await orchestrateJudge0Submission(judge0Client, {
      code,
      language,
      testCases: testCases as TestCase[],
    });

    // Prepare testCases for Firestore by stringifying all nested arrays in input and output
    const testCasesForFirestore = JSON.parse(JSON.stringify(testCases as TestCase[])).map((tc: TestCase) => {
      // Helper function to recursively process all nested arrays
      const processNestedArrays = (obj: any): any => {
        if (Array.isArray(obj)) {
          // If the item itself is an array, check if it contains arrays
          if (obj.some(item => Array.isArray(item))) {
            // If array contains arrays, stringify it
            return JSON.stringify(obj);
          }
          // If simple array with no nested arrays, keep as is
          return obj;
        } else if (obj && typeof obj === 'object') {
          // If object, process each property
          const result: any = {};
          for (const key in obj) {
            result[key] = processNestedArrays(obj[key]);
          }
          return result;
        }
        // Return primitives as is
        return obj;
      };

      // Process both input and output
      return {
        ...tc,
        input: processNestedArrays(tc.input),
        output: processNestedArrays(tc.output)
      };
    });

    // Store submission details in Firestore
    await createCodeSubmission({
      id: submissionResult.internalSubmissionId,
      code,
      language,
      judge0Tokens: submissionResult.judge0Tokens.map((t: { token: string }) => t.token), // Explicit type for t
      status: 'pending', // Initial status
      testCases: testCasesForFirestore, // Use the transformed version for Firestore
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
      testCasesTotal: (request.body as any)?.testCases?.length || 0, // Attempt to get total, might not be available
      executionTime: null,
      memoryUsage: null,
      status: 'error' // Add a status field to the error response
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
} 