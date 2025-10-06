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

// Import helper functions from problemDatastoreUtils
import {
  convertProblemToFirestore,
  pollForResults,
  slugToProblemName,
  getProblemById,
} from '../../lib/problem/problemDatastoreUtils';

/**
 * Load custom_id to slug mapping for shortened IDs
 */
function loadIdMapping(): Record<string, string> {
  const mappingPath = path.join(BATCH_PROMPTS_DIR, 'id-mapping.json');
  if (fs.existsSync(mappingPath)) {
    return JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
  }
  return {};
}

/**
 * Resolve custom_id back to original slug
 */
function resolveSlug(customId: string, idMapping: Record<string, string>): string {
  return idMapping[customId] || customId;
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
        skipped_existing: 0,
        successful_parsing: 0,
        failed_parsing: 0,
        successful_verification: 0,
        failed_verification: 0,
        uploaded_to_firestore: 0,
        failed_upload: 0,
        errors: [],
      };

      // Configure Judge0 client with aggressive rate limit handling for batch processing
      const judge0Client = new Judge0Client({
        apiUrl: judge0DefaultConfig.apiUrl,
        apiKey: judge0DefaultConfig.apiKey,
        throttlingConfig: {
          requestMaxRetries: 5,              // Increase retries from 3 to 5
          requestInitialDelayMs: 5000,       // Start with 5 seconds instead of 100ms
          statusCheckMaxRetries: 5,          // Increase status check retries
          statusCheckInitialDelayMs: 3000,   // 3 seconds for status checks
          interBatchDelayMs: 2000,           // 2 seconds between batches
          interStatusBatchDelayMs: 2000,     // 2 seconds between status batch checks
        },
      });

      // Load ID mapping to resolve shortened custom_ids back to slugs
      const idMapping = loadIdMapping();

      // Add delay between problem processing to avoid rate limiting
      // With Judge0 free tier, we need significant delays to avoid 429 errors
      const PROBLEM_PROCESSING_DELAY_MS = 5000; // 5 second delay between problems
      let problemIndex = 0;

      for (const resultLine of resultLines) {
        const result = JSON.parse(resultLine);
        summary.total_problems++;

        const customId = result.custom_id;
        const slug = resolveSlug(customId, idMapping); // Resolve custom_id to original slug

        // Phase 0: Check if problem already exists in Firestore
        const existingProblem = await getProblemById(slug);
        if (existingProblem) {
          summary.skipped_existing++;
          log(`  ⊘ Skipping ${slug} (already exists in Firestore)`, 'info');
          continue;
        }

        // Add delay between problems (except for the first one)
        if (problemIndex > 0) {
          log(`  Waiting ${PROBLEM_PROCESSING_DELAY_MS}ms before processing next problem...`, 'info');
          await new Promise(resolve => setTimeout(resolve, PROBLEM_PROCESSING_DELAY_MS));
        }
        problemIndex++;

        // Phase 1: Parse problem data
        let problemData: ProcessedProblemData | null = null;

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
          const problemName = slugToProblemName(slug);

          problemData = parseAndProcessProblemData(
            responseContent,
            problemName
          );

          if (problemData.error) {
            throw new Error(problemData.error);
          }

          summary.successful_parsing++;

          // Limit to first 20 test cases for verification and upload
          problemData.testCases = problemData.testCases.slice(0, 20);
        } catch (error) {
          summary.failed_parsing++;
          summary.errors.push({
            slug,
            error: (error as Error).message,
            phase: 'parsing',
          });
          log(`    ✗ Parsing failed for ${slug}: ${(error as Error).message}`, 'error');
          continue; // Skip to next problem
        }

        // Phase 2: Verify test cases with Judge0
        let verificationPassed = false;

        const primaryLanguage = 'python';
        const langDetails = problemData.languageSpecificDetails?.[primaryLanguage];

        if (
          langDetails &&
          langDetails.optimizedSolutionCode &&
          langDetails.boilerplateCodeWithPlaceholder &&
          problemData.testCases &&
          problemData.testCases.length > 0
        ) {
          try {
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

            // Retry logic for Judge0 rate limiting at orchestration level
            // This provides an additional layer on top of Judge0Client's built-in retries
            const MAX_JUDGE0_RETRIES = 3;
            const INITIAL_BACKOFF_MS = 10000; // Start with 10 seconds
            let judge0Attempt = 0;
            let orchestrationOutput;

            while (judge0Attempt <= MAX_JUDGE0_RETRIES) {
              try {
                orchestrationOutput = await orchestrateJudge0Submission(
                  judge0Client,
                  submissionInput
                );
                break; // Success, exit retry loop
              } catch (error: any) {
                const isRateLimitError = error?.message?.includes('429') ||
                                        error?.message?.includes('Too Many Requests') ||
                                        error?.message?.includes('Rate limit');

                if (isRateLimitError && judge0Attempt < MAX_JUDGE0_RETRIES) {
                  // Exponential backoff: 10s, 20s, 40s
                  const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, judge0Attempt);
                  judge0Attempt++;
                  log(`    ⚠ Rate limited by Judge0 (after ${judge0Attempt - 1} retries). Waiting ${backoffMs / 1000}s before retry ${judge0Attempt}/${MAX_JUDGE0_RETRIES}`, 'warn');
                  await new Promise(resolve => setTimeout(resolve, backoffMs));
                } else {
                  throw error; // Not a rate limit error or max retries exceeded
                }
              }
            }

            if (
              !orchestrationOutput ||
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
              throw new Error(aggregatedResults.error || 'Test cases failed');
            }

            summary.successful_verification++;
            verificationPassed = true;
            log(`    ✓ Verification passed`, 'info');
          } catch (error) {
            summary.failed_verification++;
            summary.errors.push({
              slug,
              error: (error as Error).message,
              phase: 'verification',
            });
            log(`    ✗ Verification failed for ${slug}: ${(error as Error).message}`, 'error');
            continue; // Skip upload if verification failed
          }
        } else {
          log(`    ⚠ Skipping verification (missing Python details)`, 'warn');
        }

        // Phase 3: Upload to Firestore
        try {
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
          summary.failed_upload++;
          summary.errors.push({
            slug,
            error: (error as Error).message,
            phase: 'upload',
          });
          log(`    ✗ Upload failed for ${slug}: ${(error as Error).message}`, 'error');
        }
      }

      // Update metadata with results
      metadata.results = {
        total_processed: summary.total_problems,
        skipped_existing: summary.skipped_existing,
        successfully_verified: summary.successful_verification,
        verification_failed: summary.failed_verification,
        uploaded_to_firestore: summary.uploaded_to_firestore,
      };

      saveBatchMetadata(metadata);

      // Print summary
      console.log('\n  Summary:');
      console.log(`    Total problems: ${summary.total_problems}`);
      console.log(`    ⊘ Skipped (already exist): ${summary.skipped_existing}`);
      console.log(`    \n    Parsing:`);
      console.log(`      ✓ Successful: ${summary.successful_parsing}`);
      console.log(`      ✗ Failed: ${summary.failed_parsing}`);
      console.log(`    \n    Verification:`);
      console.log(`      ✓ Successful: ${summary.successful_verification}`);
      console.log(`      ✗ Failed: ${summary.failed_verification}`);
      console.log(`    \n    Firestore Upload:`);
      console.log(`      ✓ Uploaded: ${summary.uploaded_to_firestore}`);
      console.log(`      ✗ Failed: ${summary.failed_upload}`);
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
