import { NextRequest, NextResponse } from 'next/server';
import { Judge0SubmissionDetail } from '../../../../lib/code-execution/judge0Client';
import { getCodeSubmission, updateCodeSubmissionStatus } from '../../../../lib/code-execution/codeExecutionUtils';
import { aggregateBatchResults } from '../../../../lib/code-execution/codeExecution';
import type { CodeSubmission } from '../../../../lib/code-execution/codeExecutionUtils';

// Helper function to process nested arrays before storing in Firestore
function processNestedArraysForFirestore(obj: any): any {
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
    const result: any = {};
    for (const key in obj) {
      result[key] = processNestedArraysForFirestore(obj[key]);
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
    // Ensure originalSubmissionData.testCases is correctly typed or cast if necessary
    // The aggregateBatchResults function expects TestCase[] from '../../data-types/problem'
    // codeSubmissionUtils.CodeSubmission stores testCases as any[], so casting might be needed
    // or the type in CodeSubmission should be more specific if possible.
    const aggregatedResults = aggregateBatchResults(
      judge0ResultsArray,
      originalSubmissionData.testCases as any[] // Assuming TestCase structure matches
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