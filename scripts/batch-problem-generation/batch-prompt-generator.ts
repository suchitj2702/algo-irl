#!/usr/bin/env node
/**
 * Batch Prompt Generator for Problem Generation
 *
 * Reads problem URLs from input file and generates Claude Batch API format JSONL files.
 * Each JSONL file contains up to 10,000 requests (Claude Batch API limit).
 *
 * Usage:
 *   npx tsx scripts/batch-problem-generation/batch-prompt-generator.ts
 */

// IMPORTANT: Load environment variables FIRST, before any other imports
import './load-env';

import * as fs from 'fs';
import * as path from 'path';
import { ClaudeBatchRequest } from './types';
import {
  ensureDirectories,
  readProblemUrls,
  generateBatchName,
  getNextBatchIndex,
  log,
  extractSlugFromUrl,
  getProblemDataGenerationPrompt,
  PROBLEM_GENERATION_SYSTEM_PROMPT,
  slugToProblemName,
  INPUT_DIR,
  BATCH_PROMPTS_DIR,
} from './utils';

// Import Firestore to check existing problems
import { adminDb } from '../../lib/firebase/firebaseAdmin';

// Import LLM task configuration
import { llmTaskConfigurations } from '../../lib/llmServices/llmUtils';

// Constants
const CLAUDE_BATCH_LIMIT = 10000; // Maximum requests per batch file
const INPUT_FILE = path.join(INPUT_DIR, 'problems.txt');

// Model configuration from llmTaskConfigurations.problemGeneration
const problemGenConfig = llmTaskConfigurations.problemGeneration;
const CLAUDE_MODEL = problemGenConfig.model;
const MAX_TOKENS = problemGenConfig.max_tokens || 16384;
const THINKING_BUDGET_TOKENS = problemGenConfig.claude_options?.thinking?.budget_tokens || 8192;

/**
 * Generate a shortened custom_id that fits within Anthropic's 64 character limit.
 * Uses base index + hash for uniqueness when slug is too long.
 */
function generateCustomId(slug: string, index: number): string {
  // Anthropic Batch API custom_id limit is 64 characters
  const MAX_CUSTOM_ID_LENGTH = 64;

  if (slug.length <= MAX_CUSTOM_ID_LENGTH) {
    return slug;
  }

  // For long slugs, use: "idx_<index>_<first40chars>_<hash>"
  // This ensures uniqueness and readability
  const hash = require('crypto').createHash('md5').update(slug).digest('hex').substring(0, 8);
  const prefix = `idx_${index}_`;
  const maxSlugChars = MAX_CUSTOM_ID_LENGTH - prefix.length - 1 - hash.length; // -1 for underscore
  const truncatedSlug = slug.substring(0, maxSlugChars);

  return `${prefix}${truncatedSlug}_${hash}`;
}

/**
 * Generate Claude Batch API request for a problem
 */
function generateBatchRequest(url: string, slug: string, index: number): ClaudeBatchRequest {
  const problemName = slugToProblemName(slug);
  const prompt = getProblemDataGenerationPrompt(problemName, slug);
  const customId = generateCustomId(slug, index);

  return {
    custom_id: customId,
    params: {
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      thinking: {
        type: 'enabled',
        budget_tokens: THINKING_BUDGET_TOKENS,
      },
      system: PROBLEM_GENERATION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    },
  };
}

/**
 * Save batch requests to JSONL file
 */
function saveBatchFile(requests: ClaudeBatchRequest[], batchName: string): string {
  const filePath = path.join(BATCH_PROMPTS_DIR, `${batchName}.jsonl`);

  const lines = requests.map(req => JSON.stringify(req)).join('\n') + '\n';
  fs.writeFileSync(filePath, lines, 'utf-8');

  return filePath;
}

/**
 * Check which problems already exist in Firestore
 * Returns a Set of existing problem slugs
 */
async function checkExistingProblems(slugs: string[]): Promise<Set<string>> {
  const existingSlugs = new Set<string>();

  try {
    const db = adminDb();
    const problemsRef = db.collection('problems');

    // Firestore limits 'in' queries to 30 items, so we need to batch
    const BATCH_SIZE = 30;

    for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
      const batch = slugs.slice(i, i + BATCH_SIZE);
      const snapshot = await problemsRef
        .where('__name__', 'in', batch)
        .select() // Only fetch document IDs, not full data
        .get();

      snapshot.forEach(doc => {
        existingSlugs.add(doc.id);
      });
    }

    log(`Found ${existingSlugs.size} existing problems in Firestore`, 'info');
  } catch (error) {
    log(`Warning: Failed to check existing problems: ${(error as Error).message}`, 'warn');
    log('Continuing without filtering...', 'warn');
  }

  return existingSlugs;
}

/**
 * Main function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Batch Prompt Generator for Problem Generation');
  console.log('═══════════════════════════════════════════════════════\n');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const skipExistingCheck = args.includes('--skip-existing-check') || args.includes('--force');

  if (skipExistingCheck) {
    log('Skipping existing problems check (--skip-existing-check flag)', 'warn');
  }

  // Ensure directories exist
  ensureDirectories();

  // Check if input file exists
  if (!fs.existsSync(INPUT_FILE)) {
    log(`Input file not found: ${INPUT_FILE}`, 'error');
    log('Please create input/problems.txt with problem URLs (one per line)', 'info');
    process.exit(1);
  }

  // Read problem URLs
  log('Reading problem URLs from input file...', 'info');
  const urls = readProblemUrls(INPUT_FILE);

  if (urls.length === 0) {
    log('No URLs found in input file', 'error');
    process.exit(1);
  }

  log(`Found ${urls.length} problem URLs`, 'info');

  // Extract slugs and validate URLs
  const problems: Array<{ url: string; slug: string }> = [];
  const invalidUrls: string[] = [];

  for (const url of urls) {
    const slug = extractSlugFromUrl(url);
    if (slug) {
      problems.push({ url, slug });
    } else {
      invalidUrls.push(url);
    }
  }

  if (invalidUrls.length > 0) {
    log(`Skipping ${invalidUrls.length} invalid URLs`, 'warn');
    invalidUrls.forEach(url => log(`  - ${url}`, 'warn'));
  }

  if (problems.length === 0) {
    log('No valid problem URLs found', 'error');
    process.exit(1);
  }

  log(`Validating ${problems.length} problems`, 'info');

  // Check which problems already exist in Firestore (unless skipped)
  let newProblems = problems;
  let skippedProblems: typeof problems = [];

  if (!skipExistingCheck) {
    log('Checking for existing problems in Firestore...', 'info');
    const existingSlugs = await checkExistingProblems(problems.map(p => p.slug));

    // Filter out existing problems
    newProblems = problems.filter(({ slug }) => !existingSlugs.has(slug));
    skippedProblems = problems.filter(({ slug }) => existingSlugs.has(slug));

    if (skippedProblems.length > 0) {
      log(`Skipping ${skippedProblems.length} problems that already exist:`, 'info');
      skippedProblems.forEach(({ slug }) => log(`  - ${slug}`, 'info'));
    }

    if (newProblems.length === 0) {
      log('All problems already exist in Firestore. Nothing to generate!', 'info');
      log('Use --skip-existing-check to regenerate anyway.', 'info');
      process.exit(0);
    }
  }

  log(`Generating prompts for ${newProblems.length} new problems`, 'info');

  // Generate batch requests with index for custom_id generation
  const allRequests: ClaudeBatchRequest[] = newProblems.map(({ url, slug }, index) =>
    generateBatchRequest(url, slug, index)
  );

  // Create mapping file: custom_id -> slug (for long slugs that were shortened)
  const idMapping: Record<string, string> = {};
  allRequests.forEach((req, index) => {
    const slug = newProblems[index].slug;
    if (req.custom_id !== slug) {
      idMapping[req.custom_id] = slug;
    }
  });

  // Split into batch files (max CLAUDE_BATCH_LIMIT per file)
  const batches: ClaudeBatchRequest[][] = [];
  for (let i = 0; i < allRequests.length; i += CLAUDE_BATCH_LIMIT) {
    batches.push(allRequests.slice(i, i + CLAUDE_BATCH_LIMIT));
  }

  log(`Splitting into ${batches.length} batch file(s)`, 'info');

  // Save ID mapping file if there are any shortened IDs
  if (Object.keys(idMapping).length > 0) {
    const mappingPath = path.join(BATCH_PROMPTS_DIR, 'id-mapping.json');

    // Load existing mapping if it exists
    let existingMapping: Record<string, string> = {};
    if (fs.existsSync(mappingPath)) {
      existingMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
    }

    // Merge with new mapping
    const combinedMapping = { ...existingMapping, ...idMapping };
    fs.writeFileSync(mappingPath, JSON.stringify(combinedMapping, null, 2), 'utf-8');

    log(`Updated ID mapping file with ${Object.keys(idMapping).length} shortened IDs`, 'info');
  }

  // Save batch files
  let batchIndex = getNextBatchIndex();
  const savedFiles: string[] = [];

  for (const batchRequests of batches) {
    const batchName = generateBatchName(batchIndex);
    const filePath = saveBatchFile(batchRequests, batchName);
    savedFiles.push(filePath);

    log(`Created ${batchName}.jsonl with ${batchRequests.length} requests`, 'info');
    batchIndex++;
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total problems in input: ${problems.length}`);
  console.log(`Already exist in Firestore: ${skippedProblems.length}`);
  console.log(`New problems to generate: ${newProblems.length}`);
  console.log(`Batch files created: ${batches.length}`);
  console.log(`Output directory: ${BATCH_PROMPTS_DIR}`);

  if (savedFiles.length > 0) {
    console.log('\nGenerated files:');
    savedFiles.forEach(file => console.log(`  - ${path.basename(file)}`));

    console.log('\nNext steps:');
    console.log('  1. Review the generated JSONL files');
    console.log('  2. Run: npx tsx scripts/batch-problem-generation/batch-job-manager.ts submit');
  }

  console.log('═══════════════════════════════════════════════════════\n');
}

// Run main function
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
