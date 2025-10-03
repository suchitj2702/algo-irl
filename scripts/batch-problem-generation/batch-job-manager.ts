#!/usr/bin/env node
/**
 * Batch Job Manager for Problem Generation
 *
 * Manages the complete lifecycle of batch jobs:
 * - submit: Upload JSONL files and create batch jobs
 * - status: Check status of active batch jobs
 * - process: Download results, verify, and upload to Firestore
 * - run: Execute all phases sequentially
 *
 * Usage:
 *   npx tsx scripts/batch-problem-generation/batch-job-manager.ts <command>
 *   npx tsx scripts/batch-problem-generation/batch-job-manager.ts submit
 *   npx tsx scripts/batch-problem-generation/batch-job-manager.ts status
 *   npx tsx scripts/batch-problem-generation/batch-job-manager.ts process
 *   npx tsx scripts/batch-problem-generation/batch-job-manager.ts run
 */

// IMPORTANT: Load environment variables FIRST, before any other imports
import './load-env';

import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import {
  BatchMetadata,
  ProblemProcessingResult,
  BatchProcessingSummary,
} from './types';
import {
  ensureDirectories,
  saveBatchMetadata,
  loadBatchMetadata,
  getAllBatchMetadata,
  discoverUnsubmittedBatchFiles,
  log,
  formatTimestamp,
  countJsonlLines,
  BATCH_PROMPTS_DIR,
  BATCH_RESULTS_DIR,
} from './utils';

// Import from existing utilities
import { adminDb } from '../../lib/firebase/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Problem, TestCase } from '../../data-types/problem';
import {
  parseAndProcessProblemData,
  ProcessedProblemData,
} from '../../lib/llmServices/llmUtils';
import { Judge0Client } from '../../lib/code-execution/judge0Client';
import {
  orchestrateJudge0Submission,
  aggregateBatchResults,
  OrchestratedSubmissionInput,
} from '../../lib/code-execution/codeExecution';
import judge0DefaultConfig from '../../lib/code-execution/judge0Config';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Helper function to convert Problem to Firestore format
 */
function convertProblemToFirestore(
  modelObject: Partial<Problem>
): Record<string, unknown> {
  const data = { ...modelObject } as Partial<Problem>;
  delete data.id;

  data.updatedAt = Timestamp.now();
  if (!data.createdAt) {
    data.createdAt = Timestamp.now();
  }

  if (data.createdAt instanceof Date) {
    data.createdAt = Timestamp.fromDate(data.createdAt);
  }
  if (data.updatedAt instanceof Date) {
    data.updatedAt = Timestamp.fromDate(data.updatedAt);
  }
  return data as Record<string, unknown>;
}

/**
 * Helper function to poll Judge0 results
 */
async function pollForResults(
  client: Judge0Client,
  tokens: string,
  expectedCount: number
): Promise<any[]> {
  let submissionDetails: any[] = [];
  let attempts = 0;
  const maxPollingAttempts = 15;
  const pollingIntervalMs = 2000;

  while (attempts < maxPollingAttempts) {
    await new Promise(resolve => setTimeout(resolve, pollingIntervalMs));
    const batchDetailsResponse = await client.getBatchSubmissionDetails(tokens);

    if (batchDetailsResponse && batchDetailsResponse.submissions) {
      const allProcessed = batchDetailsResponse.submissions.every(
        s => s.status.id > 2
      );
      if (
        allProcessed &&
        batchDetailsResponse.submissions.length === expectedCount
      ) {
        submissionDetails = batchDetailsResponse.submissions;
        break;
      }
    }
    attempts++;
  }

  if (submissionDetails.length !== expectedCount) {
    throw new Error(
      `Polling timeout or results incomplete. Expected ${expectedCount}, got ${submissionDetails.length}.`
    );
  }
  return submissionDetails;
}

/**
 * Command: Submit batch jobs
 */
async function submitBatchJobs(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Phase 1: Submit Batch Jobs');
  console.log('═══════════════════════════════════════════════════════\n');

  const unsubmittedFiles = discoverUnsubmittedBatchFiles();

  if (unsubmittedFiles.length === 0) {
    log('No unsubmitted batch files found', 'info');
    return;
  }

  log(`Found ${unsubmittedFiles.length} unsubmitted batch file(s)`, 'info');

  for (const filePath of unsubmittedFiles) {
    const batchName = path.basename(filePath, '.jsonl');
    log(`Submitting batch: ${batchName}`, 'info');

    try {
      // Read JSONL file
      const content = fs.readFileSync(filePath, 'utf-8');
      const requests = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      log(`  Request count: ${requests.length}`, 'info');

      // Create batch job via Anthropic API
      const batch = await anthropic.messages.batches.create({
        requests,
      });

      log(`  Batch ID: ${batch.id}`, 'info');
      log(`  Status: ${batch.processing_status}`, 'info');

      // Map Anthropic API status to our internal status
      const mapStatus = (apiStatus: string): BatchMetadata['status'] => {
        switch (apiStatus) {
          case 'in_progress':
            return 'in_progress';
          case 'canceling':
            return 'canceled';
          case 'ended':
            return 'completed';
          default:
            return 'pending';
        }
      };

      // Save metadata
      const metadata: BatchMetadata = {
        batch_id: batch.id,
        batch_name: batchName,
        prompt_file: filePath,
        status: mapStatus(batch.processing_status),
        request_count: requests.length,
        created_at: formatTimestamp(),
        last_checked: formatTimestamp(),
      };

      saveBatchMetadata(metadata);
      log(`  Metadata saved`, 'info');
    } catch (error) {
      log(`  Error submitting batch: ${(error as Error).message}`, 'error');
    }
  }

  log('\nSubmission phase completed', 'info');
}

/**
 * Command: Check status of batch jobs
 */
async function checkBatchStatus(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Phase 2: Check Batch Status');
  console.log('═══════════════════════════════════════════════════════\n');

  const allMetadata = getAllBatchMetadata();

  if (allMetadata.length === 0) {
    log('No batch jobs found', 'info');
    return;
  }

  // Filter active jobs (not completed/failed/canceled)
  const activeJobs = allMetadata.filter(
    m => !['completed', 'failed', 'canceled'].includes(m.status)
  );

  if (activeJobs.length === 0) {
    log('No active batch jobs', 'info');
    log(`Total jobs: ${allMetadata.length} (all completed/failed/canceled)`, 'info');
    return;
  }

  log(`Checking status of ${activeJobs.length} active job(s)`, 'info');

  for (const metadata of activeJobs) {
    log(`\nBatch: ${metadata.batch_name}`, 'info');
    log(`  Batch ID: ${metadata.batch_id}`, 'info');

    try {
      // Retrieve batch status from Anthropic API
      const batch = await anthropic.messages.batches.retrieve(metadata.batch_id);

      // Map Anthropic API status to our internal status
      const mapStatus = (apiStatus: string): BatchMetadata['status'] => {
        switch (apiStatus) {
          case 'in_progress':
            return 'in_progress';
          case 'canceling':
            return 'canceled';
          case 'ended':
            return 'completed';
          default:
            return 'pending';
        }
      };

      const oldStatus = metadata.status;
      const newStatus = mapStatus(batch.processing_status);

      log(`  Status: ${oldStatus} → ${newStatus}`, 'info');

      if (batch.request_counts) {
        log(`  Requests:`, 'info');
        log(`    Processing: ${batch.request_counts.processing}`, 'info');
        log(`    Succeeded: ${batch.request_counts.succeeded}`, 'info');
        log(`    Errored: ${batch.request_counts.errored}`, 'info');
        log(`    Canceled: ${batch.request_counts.canceled}`, 'info');
        log(`    Expired: ${batch.request_counts.expired}`, 'info');
      }

      // Update metadata with mapped status
      metadata.status = newStatus;
      metadata.last_checked = formatTimestamp();

      if (batch.request_counts) {
        metadata.request_counts = {
          processing: batch.request_counts.processing,
          succeeded: batch.request_counts.succeeded,
          errored: batch.request_counts.errored,
          canceled: batch.request_counts.canceled,
          expired: batch.request_counts.expired,
        };
      }

      if (newStatus === 'completed') {
        metadata.completed_at = formatTimestamp();
        log(`  ✓ Batch completed!`, 'info');
      }

      saveBatchMetadata(metadata);
    } catch (error) {
      log(`  Error checking status: ${(error as Error).message}`, 'error');
    }
  }

  log('\nStatus check completed', 'info');
}

/**
 * Command: Process completed batch jobs
 */
async function processCompletedJobs(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Phase 3: Process Completed Batch Jobs');
  console.log('═══════════════════════════════════════════════════════\n');

  const allMetadata = getAllBatchMetadata();
  const completedJobs = allMetadata.filter(
    m => m.status === 'completed' && !m.results
  );

  if (completedJobs.length === 0) {
    log('No completed jobs to process', 'info');
    return;
  }

  log(`Processing ${completedJobs.length} completed job(s)`, 'info');

  for (const metadata of completedJobs) {
    log(`\nProcessing batch: ${metadata.batch_name}`, 'info');

    try {
      // Download results from Anthropic API
      log(`  Downloading results...`, 'info');

      const results = await anthropic.messages.batches.results(metadata.batch_id);

      // Save results to JSONL file
      const resultsPath = path.join(
        BATCH_RESULTS_DIR,
        `${metadata.batch_name}_results.jsonl`
      );

      // Convert async iterable to array and write to file
      const resultLines: string[] = [];
      for await (const result of results) {
        resultLines.push(JSON.stringify(result));
      }

      fs.writeFileSync(resultsPath, resultLines.join('\n'), 'utf-8');
      log(`  Results saved to: ${path.basename(resultsPath)}`, 'info');

      // Process each result
      const summary: BatchProcessingSummary = {
        total_problems: 0,
        successful_parsing: 0,
        failed_parsing: 0,
        successful_verification: 0,
        failed_verification: 0,
        uploaded_to_firestore: 0,
        errors: [],
      };

      const judge0Client = new Judge0Client({
        apiUrl: judge0DefaultConfig.apiUrl,
        apiKey: judge0DefaultConfig.apiKey,
      });

      for (const resultLine of resultLines) {
        const result = JSON.parse(resultLine);
        summary.total_problems++;

        const customId = result.custom_id;
        const slug = customId;

        try {
          // Extract response content
          let responseContent = '';

          if (result.result && result.result.type === 'succeeded') {
            responseContent = result.result.message.content
              .find((c: any) => c.type === 'text')
              ?.text || '';
          } else {
            throw new Error(`Batch result failed or invalid: ${result.result?.type}`);
          }

          if (!responseContent) {
            throw new Error('Empty response content');
          }

          // Parse problem data
          const problemName = slug
            .split('-')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          const problemData: ProcessedProblemData = parseAndProcessProblemData(
            responseContent,
            problemName
          );

          if (problemData.error) {
            throw new Error(`Parsing error: ${problemData.error}`);
          }

          summary.successful_parsing++;

          // Verify test cases with Judge0
          const primaryLanguage = 'python';
          const langDetails = problemData.languageSpecificDetails?.[primaryLanguage];

          if (
            langDetails &&
            langDetails.optimizedSolutionCode &&
            langDetails.boilerplateCodeWithPlaceholder &&
            problemData.testCases &&
            problemData.testCases.length > 0
          ) {
            log(`  Verifying test cases for: ${slug}`, 'info');

            const allTestCases: TestCase[] = problemData.testCases.map(tc => ({
              stdin: tc.stdin,
              expectedStdout: tc.expectedStdout,
              explanation: tc.explanation,
              isSample: tc.isSample || false,
            }));

            const submissionInput: OrchestratedSubmissionInput = {
              code: langDetails.optimizedSolutionCode,
              language: primaryLanguage,
              testCases: allTestCases,
              boilerplateCode: langDetails.boilerplateCodeWithPlaceholder,
            };

            const orchestrationOutput = await orchestrateJudge0Submission(
              judge0Client,
              submissionInput
            );

            if (
              !orchestrationOutput.judge0Tokens ||
              orchestrationOutput.judge0Tokens.length === 0
            ) {
              throw new Error('Failed to create verification batch submissions');
            }

            const tokensStr = orchestrationOutput.judge0Tokens
              .map(tr => tr.token)
              .join(',');

            const submissionDetails = await pollForResults(
              judge0Client,
              tokensStr,
              allTestCases.length
            );

            const aggregatedResults = aggregateBatchResults(
              submissionDetails,
              allTestCases
            );

            if (!aggregatedResults.passed) {
              throw new Error(
                `Verification failed: ${aggregatedResults.error || 'Test cases failed'}`
              );
            }

            summary.successful_verification++;
            log(`    ✓ Verification passed`, 'info');
          } else {
            log(`    ⚠ Skipping verification (missing Python details)`, 'warn');
          }

          // Upload to Firestore
          const problem: Omit<Problem, 'id' | 'createdAt' | 'updatedAt'> = {
            title: problemData.title,
            difficulty: problemData.difficulty,
            categories: problemData.categories,
            description: problemData.description,
            constraints: problemData.constraints,
            leetcodeLink: `https://leetcode.com/problems/${slug}/`,
            isBlind75: false,
            testCases: problemData.testCases.map(tc => ({
              stdin: tc.stdin,
              expectedStdout: tc.expectedStdout,
              explanation: tc.explanation,
              isSample: tc.isSample || false,
            })),
            solutionApproach: problemData.solutionApproach,
            timeComplexity: problemData.timeComplexity,
            spaceComplexity: problemData.spaceComplexity,
            languageSpecificDetails: problemData.languageSpecificDetails || {
              python: {
                solutionFunctionNameOrClassName: 'fallback_func',
                solutionStructureHint: '',
                defaultUserCode: '',
                boilerplateCodeWithPlaceholder: '',
                optimizedSolutionCode: '',
              },
            },
          };

          const db = adminDb();
          const docRef = db.collection('problems').doc(slug);
          await docRef.set(convertProblemToFirestore(problem));

          summary.uploaded_to_firestore++;
          log(`    ✓ Uploaded to Firestore: ${slug}`, 'info');
        } catch (error) {
          summary.failed_parsing++;
          summary.errors.push({
            slug,
            error: (error as Error).message,
          });
          log(`    ✗ Error processing ${slug}: ${(error as Error).message}`, 'error');
        }
      }

      // Update metadata with results
      metadata.results = {
        total_processed: summary.total_problems,
        successfully_verified: summary.successful_verification,
        verification_failed: summary.failed_verification,
        uploaded_to_firestore: summary.uploaded_to_firestore,
      };

      saveBatchMetadata(metadata);

      // Print summary
      console.log('\n  Summary:');
      console.log(`    Total problems: ${summary.total_problems}`);
      console.log(`    Successfully parsed: ${summary.successful_parsing}`);
      console.log(`    Parsing failures: ${summary.failed_parsing}`);
      console.log(`    Successfully verified: ${summary.successful_verification}`);
      console.log(`    Verification failures: ${summary.failed_verification}`);
      console.log(`    Uploaded to Firestore: ${summary.uploaded_to_firestore}`);

      if (summary.errors.length > 0) {
        console.log('\n  Errors:');
        summary.errors.forEach(err => {
          console.log(`    - ${err.slug}: ${err.error}`);
        });
      }
    } catch (error) {
      log(`  Error processing batch: ${(error as Error).message}`, 'error');
      metadata.error = (error as Error).message;
      saveBatchMetadata(metadata);
    }
  }

  log('\nProcessing phase completed', 'info');
}

/**
 * Command: Run all phases
 */
async function runAll(): Promise<void> {
  await submitBatchJobs();
  await checkBatchStatus();
  await processCompletedJobs();
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2];

  if (!command) {
    console.log('Usage: npx tsx scripts/batch-problem-generation/batch-job-manager.ts <command>');
    console.log('\nCommands:');
    console.log('  submit   - Submit batch jobs from JSONL files');
    console.log('  status   - Check status of active batch jobs');
    console.log('  process  - Process completed batch jobs');
    console.log('  run      - Run all phases sequentially');
    process.exit(1);
  }

  ensureDirectories();

  switch (command) {
    case 'submit':
      await submitBatchJobs();
      break;
    case 'status':
      await checkBatchStatus();
      break;
    case 'process':
      await processCompletedJobs();
      break;
    case 'run':
      await runAll();
      break;
    default:
      log(`Unknown command: ${command}`, 'error');
      process.exit(1);
  }
}

// Run main function
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
