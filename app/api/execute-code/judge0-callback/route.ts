import { NextRequest, NextResponse } from 'next/server';
import { Judge0SubmissionDetail } from '../../../../lib/code-execution/judge0Client';
import { getCodeSubmission, updateCodeSubmissionStatus } from '../../../../lib/code-execution/codeExecutionUtils';
import { aggregateBatchResults } from '../../../../lib/code-execution/codeExecution';
import type { CodeSubmission } from '../../../../lib/code-execution/codeExecutionUtils';

// SECURITY NOTE: This endpoint is called by Judge0 servers, not by the frontend
// Therefore, it cannot use the same signature-based authentication.
// Instead, implement one of these security measures:
// 1. IP whitelisting for Judge0 servers
// 2. Webhook secret in the callback URL (e.g., /api/execute-code/judge0-callback?secret=xxx)
// 3. Basic authentication header from Judge0

// TODO: Implement Judge0 webhook security
// For now, this endpoint is protected by:
// - The random submission ID which acts as a secret
// - Rate limiting at the middleware level
// - CORS headers (though Judge0 doesn't use browser requests)

// Helper function to process nested arrays before storing in Firestore
function processNestedArraysForFirestore(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    // If the item itself is an array, check if it contains arrays
    if (obj.some(item => Array.isArray(item) || (typeof item === 'object' && item !== null))) {
      // If array contains arrays or objects that might contain arrays, stringify it
      return JSON.stringify(obj);
    }
    // If simple array with no nested arrays, keep as is
    return obj;
  } else if (obj && typeof obj === 'object') {
    // If object, process each property
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      result[key] = processNestedArraysForFirestore((obj as Record<string, unknown>)[key]);
    }
    return result;
  }
  // Return primitives as is
  return obj;
}

// Ensure this is only accessible via POST from Judge0 (consider IP whitelisting or a secret token if possible)
export async function POST(request: NextRequest) {
  try {
    // 1. Extract internalSubmissionId from query params
    const { searchParams } = new URL(request.url);
    const internalSubmissionId = searchParams.get('submissionId');

    if (!internalSubmissionId) {
      console.error('Judge0 Callback: Missing submissionId query parameter.');
      return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 });
    }

    // 2. Parse incoming array of Judge0 submission results
    // Judge0 sends an array of submission objects directly in the body for batch callbacks.
    const judge0ResultsArray: Judge0SubmissionDetail[] = await request.json();

    if (!Array.isArray(judge0ResultsArray)) {
      console.error('Judge0 Callback: Invalid payload. Expected an array of submission results.', { submissionId: internalSubmissionId });
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
    }

    // 3. Fetch original CodeSubmission data (which includes testCases)
    const originalSubmissionData: CodeSubmission | null = await getCodeSubmission(internalSubmissionId);

    if (!originalSubmissionData) {
      console.error('Judge0 Callback: Original submission data not found for id:', internalSubmissionId);
      // Still return 200 to Judge0 to acknowledge receipt, but log error.
      return NextResponse.json({ error: 'Original submission not found' }, { status: 200 }); 
    }

    if (originalSubmissionData.status === 'completed' || originalSubmissionData.status === 'error') {
        console.log(`Judge0 Callback: Submission ${internalSubmissionId} already processed. Current status: ${originalSubmissionData.status}`);
        // Acknowledge to prevent Judge0 retries, but don't re-process.
        return NextResponse.json({ message: 'Submission already processed' }, { status: 200 });
    }

    // 4. Aggregate results
    // The aggregateBatchResults function expects TestCase[] from '../../data-types/problem'
    // CodeSubmission.testCases is now properly typed as TestCase[]
    const aggregatedResults = aggregateBatchResults(
      judge0ResultsArray,
      originalSubmissionData.testCases
    );

    // Process nested arrays in the aggregated results before updating Firestore
    const processedResults = processNestedArraysForFirestore(aggregatedResults);

    // 5. Update Firestore with aggregated results
    await updateCodeSubmissionStatus(
      internalSubmissionId,
      aggregatedResults.error ? 'error' : 'completed',
      processedResults
    );

    console.log(`Judge0 Callback: Successfully processed submission ${internalSubmissionId}`);
    // 6. Respond to Judge0
    return NextResponse.json({ message: 'Callback received and processed.' }, { status: 200 });

  } catch (error) {
    console.error('Judge0 Callback: Error processing callback:', error);
    // Even in case of an internal error, try to send a 200 to Judge0 if possible,
    // to prevent retries, unless it's a payload format issue.
    // However, if our server is having issues, a 500 might be more appropriate for us to debug.
    return NextResponse.json({ error: 'Failed to process callback' }, { status: 500 });
  }
} 