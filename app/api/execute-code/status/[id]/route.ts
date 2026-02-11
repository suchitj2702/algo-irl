import { NextRequest } from 'next/server';
import { getCodeSubmission, updateCodeSubmissionStatus, CodeSubmission } from '../../../../../lib/code-execution/codeExecutionUtils';
import { Judge0Client } from '../../../../../lib/code-execution/judge0Client';
import judge0Config from '../../../../../lib/code-execution/judge0Config';
import { aggregateBatchResults } from '../../../../../lib/code-execution/codeExecution';
import { TestCase } from '../../../../../data-types/problem';
import { withCors } from '@/lib/shared/apiResponse';

const judge0Client = new Judge0Client({
  apiUrl: judge0Config.apiUrl,
  apiKey: judge0Config.apiKey,
});

// Helper function to process nested arrays before storing in Firestore
function processNestedArraysForFirestore(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    if (obj.some(item => Array.isArray(item) || (typeof item === 'object' && item !== null))) {
      return JSON.stringify(obj);
    }
    return obj;
  } else if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      result[key] = processNestedArraysForFirestore((obj as Record<string, unknown>)[key]);
    }
    return result;
  }
  return obj;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: submissionId } = await params;

    if (!submissionId) {
      return withCors(request, { error: 'Submission ID is required' }, { status: 400 });
    }

    const submission: CodeSubmission | null = await getCodeSubmission(submissionId);
    if (!submission) {
      return withCors(request, { error: 'Submission not found' }, { status: 404 });
    }

    // If status is already completed or errored, return stored results
    if (submission.status === 'completed' || submission.status === 'error') {
      return withCors(request, {
        status: submission.status,
        results: submission.results,
        ...(submission.status === 'error' && {
          error: submission.results?.error || 'Unknown execution error'
        })
      }, {
        status: submission.status === 'error' ? 500 : 200,
      });
    }

    // If pending or processing, we might need to check with Judge0
    if (submission.status === 'pending' || submission.status === 'processing') {
      if (!submission.judge0Tokens || submission.judge0Tokens.length === 0) {
        console.error(`Polling: Submission ${submissionId} has no Judge0 tokens.`);
        await updateCodeSubmissionStatus(submissionId, 'error', { error: 'Missing Judge0 tokens, cannot poll status.'});
        return withCors(request, { error: 'Internal error: Missing Judge0 tokens.' }, { status: 500 });
      }

      try {
        const tokensString = submission.judge0Tokens.join(',');
        const batchDetails = await judge0Client.getBatchSubmissionDetails(tokensString);

        const judge0Submissions = batchDetails.submissions;

        // Check if any submission is still processing
        // Judge0 status IDs: 1 (In Queue), 2 (Processing)
        const isStillProcessing = judge0Submissions.some(s => s.status.id === 1 || s.status.id === 2);

        if (isStillProcessing) {
          if (submission.status === 'pending') {
            await updateCodeSubmissionStatus(submissionId, 'processing', submission.results);
          }
          return withCors(request, {
            status: 'processing',
            message: 'Submission is still processing by Judge0.'
          });
        }

        // All are completed — aggregate results and update Firestore
        const aggregatedResults = aggregateBatchResults(
          judge0Submissions,
          submission.testCases as TestCase[]
        );

        const processedResults = processNestedArraysForFirestore(aggregatedResults);

        const finalStatus = aggregatedResults.error ? 'error' : 'completed';
        await updateCodeSubmissionStatus(submissionId, finalStatus, processedResults);

        return withCors(request, {
          status: finalStatus,
          results: aggregatedResults,
          ...(finalStatus === 'error' && { error: aggregatedResults.error || 'Execution failed' })
        }, {
          status: finalStatus === 'error' ? 500 : 200,
        });

      } catch (e: unknown) {
        console.error(`Polling: Error checking Judge0 status for submission ${submissionId}:`, e);
        return withCors(request, {
          status: submission.status,
          message: 'Error communicating with Judge0. Please try again shortly.',
          error: e instanceof Error ? e.message : 'Failed to get status from Judge0'
        }, { status: 503 });
      }
    }

    // Fallback for any other unknown status
    return withCors(request, {
      status: 'unknown',
      message: 'Unknown submission status in database.'
    }, { status: 500 });

  } catch (error) {
    console.error('Error fetching submission results by ID:', error);
    return withCors(request,
      { error: error instanceof Error ? error.message : 'An unknown server error occurred' },
      { status: 500 }
    );
  }
}
