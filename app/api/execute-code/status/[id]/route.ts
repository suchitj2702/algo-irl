import { NextRequest, NextResponse } from 'next/server';
import { getCodeSubmission, updateCodeSubmissionStatus, CodeSubmission } from '../../../../../lib/code-execution/codeExecutionUtils';
import { Judge0Client } from '../../../../../lib/code-execution/judge0Client';
import judge0Config from '../../../../../lib/code-execution/judge0Config';
import { aggregateBatchResults } from '../../../../../lib/code-execution/codeExecution';
import { TestCase } from '../../../../../data-types/problem';
// import { processJudge0Results } from '../../../../../lib/code-execution/codeExecution'; // Old function

// CORS headers - keeping simple for this endpoint
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Timestamp, X-Signature, X-Hp-Field, X-Requested-With, Accept',
  'Access-Control-Max-Age': '86400',
};

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

const judge0Client = new Judge0Client({
  apiUrl: judge0Config.apiUrl,
  apiKey: judge0Config.apiKey,
  // No callbackUrl needed for client instance here
});

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js App Router, params needs to be properly awaited
    const { id: submissionId } = await params;
    
    if (!submissionId) {
      return NextResponse.json({ error: 'Submission ID is required' }, { status: 400, headers: corsHeaders });
    }
    
    const submission: CodeSubmission | null = await getCodeSubmission(submissionId);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404, headers: corsHeaders });
    }

    // If status is already completed or errored, return stored results
    if (submission.status === 'completed' || submission.status === 'error') {
      return NextResponse.json({
        status: submission.status,
        results: submission.results,
        // For error status, ensure the error message is included if available
        ...(submission.status === 'error' && { 
          error: (submission.results as Record<string, unknown>)?.error || 'Unknown execution error' 
        })
      }, { 
        status: submission.status === 'error' ? 500 : 200,
        headers: corsHeaders 
      });
    }

    // If pending or processing, we might need to check with Judge0
    // This is crucial for development (no callbacks) or if a production callback failed.
    if (submission.status === 'pending' || submission.status === 'processing') {
      if (!submission.judge0Tokens || submission.judge0Tokens.length === 0) {
        console.error(`Polling: Submission ${submissionId} has no Judge0 tokens.`);
        // This indicates an issue during submission creation. Update to error.
        await updateCodeSubmissionStatus(submissionId, 'error', { error: 'Missing Judge0 tokens, cannot poll status.'});
        return NextResponse.json({ error: 'Internal error: Missing Judge0 tokens.' }, { status: 500, headers: corsHeaders });
      }

      try {
        const tokensString = submission.judge0Tokens.join(',');
        const batchDetails = await judge0Client.getBatchSubmissionDetails(tokensString);
        
        const judge0Submissions = batchDetails.submissions;

        // Check if any submission is still processing
        // Judge0 status IDs: 1 (In Queue), 2 (Processing)
        const isStillProcessing = judge0Submissions.some(s => s.status.id === 1 || s.status.id === 2);

        if (isStillProcessing) {
          // If some are processing but submission status in DB is 'pending', update to 'processing'
          if (submission.status === 'pending') {
            await updateCodeSubmissionStatus(submissionId, 'processing', submission.results); // Keep existing results if any
          }
          return NextResponse.json({ 
            status: 'processing',
            message: 'Submission is still processing by Judge0.'
          }, { headers: corsHeaders });
        }

        // If none are processing, then all are completed (or errored from Judge0 side)
        // Aggregate results and update Firestore
        const aggregatedResults = aggregateBatchResults(
          judge0Submissions,
          submission.testCases as TestCase[] // Assuming TestCase structure matches
        );
        
        // Process nested arrays in the aggregated results before updating Firestore
        const processedResults = processNestedArraysForFirestore(aggregatedResults);
        
        const finalStatus = aggregatedResults.error ? 'error' : 'completed';
        await updateCodeSubmissionStatus(submissionId, finalStatus, processedResults);
        
        return NextResponse.json({
          status: finalStatus,
          results: aggregatedResults, // Return original unprocessed results to client
          ...(finalStatus === 'error' && { error: aggregatedResults.error || 'Execution failed' })
        }, { 
          status: finalStatus === 'error' ? 500 : 200,
          headers: corsHeaders 
        });

      } catch (e: unknown) {
        console.error(`Polling: Error checking Judge0 status for submission ${submissionId}:`, e);
        // Don't update submission status to error here, as it might be a temporary network issue
        // The client will continue polling.
        return NextResponse.json({
          status: submission.status, // Return current DB status
          message: 'Error communicating with Judge0. Please try again shortly.',
          error: e instanceof Error ? e.message : 'Failed to get status from Judge0'
        }, { status: 503, headers: corsHeaders }); // Service Unavailable for Judge0 comms error
      }
    }
    
    // Fallback for any other unknown status in DB (should ideally not happen)
    return NextResponse.json({ 
      status: 'unknown',
      message: 'Unknown submission status in database.'
    }, { status: 500, headers: corsHeaders });
    
  } catch (error) {
    console.error('Error fetching submission results by ID:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown server error occurred' }, 
      { status: 500, headers: corsHeaders }
    );
  }
} 