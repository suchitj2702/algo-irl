#!/usr/bin/env node
/**
 * Batch Job Manager for Problem Transformation
 *
 * Manages the complete lifecycle of batch transformation jobs:
 * - submit: Upload JSONL files and create batch jobs via OpenAI API
 * - status: Check status of active batch jobs
 * - process: Download results and save to Firestore transformation cache
 * - run: Execute all phases sequentially
 *
 * Usage:
 *   npx tsx scripts/batch-problem-transform/batch-job-manager.ts <command>
 *   npx tsx scripts/batch-problem-transform/batch-job-manager.ts submit
 *   npx tsx scripts/batch-problem-transform/batch-job-manager.ts status
 *   npx tsx scripts/batch-problem-transform/batch-job-manager.ts process
 *   npx tsx scripts/batch-problem-transform/batch-job-manager.ts run
 */

// IMPORTANT: Load environment variables FIRST
import './load-env';

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { BatchMetadata, TransformationResult, BatchProcessingSummary } from './types';
import { RoleFamily } from '../../data-types/role';
import {
  ensureDirectories,
  saveBatchMetadata,
  loadBatchMetadata,
  getAllBatchMetadata,
  discoverUnsubmittedBatchFiles,
  parseCustomId,
  log,
  formatTimestamp,
  countJsonlLines,
  BATCH_PROMPTS_DIR,
  BATCH_RESULTS_DIR,
} from './utils';

// Import transformation utilities
import { saveTransformation } from '../../lib/problem/transformCacheUtils';
import { ScenarioParser } from '../../lib/problem/parser/scenarioParser';
import { getProblemById } from '../../lib/problem/problemDatastoreUtils';
import { getCompanyById } from '../../lib/company/companyUtils';
import { ProblemExtractor } from '../../lib/problem/extraction/problemExtractor';
import { CompanyExtractor } from '../../lib/problem/extraction/companyExtractor';
import { AnalogyGenerator } from '../../lib/problem/analogy/analogyGenerator';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const scenarioParser = new ScenarioParser();

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
      // Count requests
      const requestCount = countJsonlLines(filePath);
      log(`  Request count: ${requestCount}`, 'info');

      // Upload file to OpenAI
      log(`  Uploading file to OpenAI...`, 'info');
      const file = await openai.files.create({
        file: fs.createReadStream(filePath),
        purpose: 'batch',
      });

      log(`  File uploaded: ${file.id}`, 'info');

      // Create batch job
      log(`  Creating batch job...`, 'info');
      const batch = await openai.batches.create({
        input_file_id: file.id,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
      });

      log(`  Batch ID: ${batch.id}`, 'info');
      log(`  Status: ${batch.status}`, 'info');

      // Save metadata
      const metadata: BatchMetadata = {
        batch_id: batch.id,
        batch_name: batchName,
        prompt_file: filePath,
        status: batch.status as BatchMetadata['status'],
        request_count: requestCount,
        created_at: formatTimestamp(new Date(batch.created_at * 1000)),
        last_checked: formatTimestamp(),
        input_file_id: file.id,
        output_file_id: batch.output_file_id || undefined,
      };

      saveBatchMetadata(metadata);
      log(`  Metadata saved`, 'success');
    } catch (error) {
      log(`  Error submitting batch: ${(error as Error).message}`, 'error');
    }
  }

  log('\nSubmission phase completed', 'success');
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
    log('Run the submit command first', 'info');
    return;
  }

  log(`Found ${allMetadata.length} batch job(s)`, 'info');

  // Filter for non-completed jobs
  const activeJobs = allMetadata.filter(
    m => m.status !== 'completed' && m.status !== 'failed' && m.status !== 'expired' && m.status !== 'cancelled'
  );

  if (activeJobs.length === 0) {
    log('All batch jobs are completed or terminated', 'info');
    return;
  }

  log(`Checking ${activeJobs.length} active job(s)...`, 'info');

  for (const metadata of activeJobs) {
    log(`\nBatch: ${metadata.batch_name}`, 'info');
    log(`  Previous status: ${metadata.status}`, 'info');

    try {
      // Retrieve current status from OpenAI
      const batch = await openai.batches.retrieve(metadata.batch_id);

      const oldStatus = metadata.status;
      const newStatus = batch.status as BatchMetadata['status'];

      log(`  Current status: ${newStatus}`, 'info');

      // Update metadata if status changed
      if (newStatus !== oldStatus) {
        metadata.status = newStatus;
        metadata.last_checked = formatTimestamp();
        metadata.output_file_id = batch.output_file_id || undefined;

        // Update request counts if available
        if (batch.request_counts) {
          metadata.request_counts = {
            total: batch.request_counts.total,
            completed: batch.request_counts.completed,
            failed: batch.request_counts.failed,
          };

          log(`  Progress: ${batch.request_counts.completed}/${batch.request_counts.total} completed`, 'info');
        }

        // Mark completion time
        if (newStatus === 'completed' && batch.completed_at) {
          metadata.completed_at = formatTimestamp(new Date(batch.completed_at * 1000));
          log(`  Completed at: ${metadata.completed_at}`, 'success');
        }

        saveBatchMetadata(metadata);
        log(`  Status updated: ${oldStatus} → ${newStatus}`, 'success');
      } else {
        log(`  No status change`, 'info');
      }
    } catch (error) {
      log(`  Error checking status: ${(error as Error).message}`, 'error');
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Status Summary');
  console.log('═══════════════════════════════════════════════════════');

  const statusCounts: Record<string, number> = {};
  for (const metadata of allMetadata) {
    statusCounts[metadata.status] = (statusCounts[metadata.status] || 0) + 1;
  }

  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`  ${status}: ${count}`);
  }

  console.log('═══════════════════════════════════════════════════════\n');
}

/**
 * Command: Process batch results
 */
async function processBatchResults(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Phase 3: Process Batch Results');
  console.log('═══════════════════════════════════════════════════════\n');

  const allMetadata = getAllBatchMetadata();

  // Filter for completed jobs that haven't been processed yet
  const completedJobs = allMetadata.filter(
    m => m.status === 'completed' && !m.result_file
  );

  if (completedJobs.length === 0) {
    log('No completed jobs to process', 'info');
    return;
  }

  log(`Found ${completedJobs.length} completed job(s) to process`, 'info');

  for (const metadata of completedJobs) {
    log(`\nProcessing batch: ${metadata.batch_name}`, 'info');

    try {
      if (!metadata.output_file_id) {
        log(`  No output file ID found, retrieving batch info...`, 'info');
        const batch = await openai.batches.retrieve(metadata.batch_id);
        if (!batch.output_file_id) {
          log(`  Batch has no output file`, 'error');
          continue;
        }
        metadata.output_file_id = batch.output_file_id;
      }

      // Download results
      log(`  Downloading results from ${metadata.output_file_id}...`, 'info');
      const fileContent = await openai.files.content(metadata.output_file_id);
      const fileText = await fileContent.text();

      // Save to local file
      const resultFileName = `${metadata.batch_name}_results.jsonl`;
      const resultFilePath = path.join(BATCH_RESULTS_DIR, resultFileName);
      fs.writeFileSync(resultFilePath, fileText, 'utf-8');

      metadata.result_file = resultFilePath;
      log(`  Results saved to: ${resultFileName}`, 'success');

      // Process results and save to transformation cache
      log(`  Processing and caching transformations...`, 'info');
      const summary = await processTransformationResults(resultFilePath, metadata);

      log(`  Successfully cached: ${summary.successfully_cached}/${summary.total_processed}`, 'success');

      if (summary.failed > 0) {
        log(`  Failed: ${summary.failed}`, 'warn');
      }

      if (summary.parsing_errors > 0) {
        log(`  Parsing errors: ${summary.parsing_errors}`, 'warn');
      }

      // Save updated metadata
      saveBatchMetadata(metadata);
    } catch (error) {
      log(`  Error processing results: ${(error as Error).message}`, 'error');
    }
  }

  log('\nProcessing phase completed', 'success');
}

/**
 * Process transformation results and save to Firestore cache
 */
async function processTransformationResults(
  resultsFilePath: string,
  metadata: BatchMetadata
): Promise<BatchProcessingSummary> {
  const summary: BatchProcessingSummary = {
    total_processed: 0,
    successfully_cached: 0,
    failed: 0,
    parsing_errors: 0,
    errors: [],
  };

  const content = fs.readFileSync(resultsFilePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const problemExtractor = new ProblemExtractor();
  const companyExtractor = new CompanyExtractor();
  const analogyGenerator = new AnalogyGenerator();

  for (const line of lines) {
    summary.total_processed++;

    try {
      const result = JSON.parse(line);

      // Parse custom ID
      const parsedId = parseCustomId(result.custom_id);
      if (!parsedId) {
        summary.parsing_errors++;
        summary.errors.push({
          custom_id: result.custom_id,
          error_type: 'invalid_custom_id',
          error_message: 'Failed to parse custom ID',
        });
        continue;
      }

      const { problemId, companyId, roleFamily } = parsedId;

      // Check if request succeeded
      if (result.error) {
        summary.failed++;
        summary.errors.push({
          custom_id: result.custom_id,
          error_type: 'api_error',
          error_message: result.error.message || 'Unknown API error',
        });
        continue;
      }

      // Extract response content
      const responseContent = result.response?.body?.choices?.[0]?.message?.content;

      if (!responseContent) {
        summary.failed++;
        summary.errors.push({
          custom_id: result.custom_id,
          error_type: 'empty_response',
          error_message: 'No response content found',
        });
        continue;
      }

      // Parse scenario into structured sections
      let structuredScenario;
      try {
        structuredScenario = scenarioParser.parseScenarioIntoSections(responseContent);
      } catch (parseError) {
        summary.parsing_errors++;
        summary.errors.push({
          custom_id: result.custom_id,
          error_type: 'parsing_error',
          error_message: (parseError as Error).message,
        });
        continue;
      }

      // Fetch problem and company to reconstruct context info
      const problem = await getProblemById(problemId);
      const company = await getCompanyById(companyId);

      if (!problem || !company) {
        summary.failed++;
        summary.errors.push({
          custom_id: result.custom_id,
          error_type: 'missing_data',
          error_message: `Problem or company not found: ${problemId}, ${companyId}`,
        });
        continue;
      }

      // Reconstruct context info
      const problemInfo = problemExtractor.extractProblemInfo(problem);
      const companyInfo = companyExtractor.extractCompanyInfo(company, problemInfo.keywords);
      const relevanceScore = companyExtractor.calculateRelevanceScore(problemInfo, companyInfo);
      const suggestedAnalogyPoints = analogyGenerator.generateSuggestedAnalogyPoints(
        problemInfo,
        companyInfo,
        roleFamily as RoleFamily
      );

      const contextInfo = {
        detectedAlgorithms: problemInfo.coreAlgorithms,
        detectedDataStructures: problemInfo.dataStructures,
        relevanceScore,
        suggestedAnalogyPoints,
      };

      // Save to transformation cache
      await saveTransformation(
        {
          problemId,
          companyId,
          scenario: responseContent,
          functionMapping: structuredScenario.functionMapping,
          contextInfo,
        },
        roleFamily as RoleFamily
      );

      summary.successfully_cached++;
    } catch (error) {
      summary.failed++;
      summary.errors.push({
        custom_id: 'unknown',
        error_type: 'processing_error',
        error_message: (error as Error).message,
      });
    }
  }

  return summary;
}

/**
 * Command: Run all phases sequentially
 */
async function runAll(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Running All Phases');
  console.log('═══════════════════════════════════════════════════════');

  await submitBatchJobs();
  await checkBatchStatus();
  await processBatchResults();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  All Phases Completed');
  console.log('═══════════════════════════════════════════════════════\n');
}

/**
 * Main function
 */
async function main() {
  ensureDirectories();

  const command = process.argv[2];

  if (!command) {
    console.log('Usage: npx tsx batch-job-manager.ts <command>');
    console.log('');
    console.log('Commands:');
    console.log('  submit   - Submit unsubmitted batch files to OpenAI');
    console.log('  status   - Check status of active batch jobs');
    console.log('  process  - Download and process completed results');
    console.log('  run      - Run all phases sequentially');
    console.log('');
    process.exit(1);
  }

  switch (command) {
    case 'submit':
      await submitBatchJobs();
      break;
    case 'status':
      await checkBatchStatus();
      break;
    case 'process':
      await processBatchResults();
      break;
    case 'run':
      await runAll();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Valid commands: submit, status, process, run');
      process.exit(1);
  }
}

// Run main function
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
