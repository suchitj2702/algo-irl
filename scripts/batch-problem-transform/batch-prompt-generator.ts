#!/usr/bin/env node
/**
 * Batch Prompt Generator for Problem Transformation
 *
 * Generates OpenAI Batch API format JSONL files for problem transformations.
 * Creates transformation prompts for all combinations of problems × companies × roles.
 *
 * Usage:
 *   npx tsx scripts/batch-problem-transform/batch-prompt-generator.ts
 *
 * Input files:
 *   - input/problems.txt: Problem IDs (one per line)
 *   - input/companies.txt: Company IDs (one per line)
 *
 * Output:
 *   - output/batch_prompts/batch_XXX_YYYYMMDD_HHMMSS.jsonl
 */

// IMPORTANT: Load environment variables FIRST
import './load-env';

import * as fs from 'fs';
import * as path from 'path';
import { OpenAIBatchRequest } from './types';
import { RoleFamily } from '../../data-types/role';
import {
  ensureDirectories,
  readProblemIds,
  readCompanyIds,
  generateCustomId,
  generateBatchName,
  getNextBatchIndex,
  log,
  INPUT_DIR,
  BATCH_PROMPTS_DIR,
  TRANSFORMATION_SYSTEM_PROMPT,
} from './utils';

// Import transformation utilities
import { getProblemById } from '../../lib/problem/problemDatastoreUtils';
import { getCompanyById } from '../../lib/company/companyUtils';
import { RolePromptGenerator } from '../../lib/problem/prompt/rolePromptGenerator';
import { RoleAnalyzer } from '../../lib/problem/role/roleAnalyzer';
import { ProblemExtractor } from '../../lib/problem/extraction/problemExtractor';
import { CompanyExtractor } from '../../lib/problem/extraction/companyExtractor';
import { AnalogyGenerator } from '../../lib/problem/analogy/analogyGenerator';

// Constants
const OPENAI_BATCH_LIMIT = 50000; // Maximum requests per batch file
const INPUT_PROBLEMS_FILE = path.join(INPUT_DIR, 'problems.txt');
const INPUT_COMPANIES_FILE = path.join(INPUT_DIR, 'companies.txt');

// Model configuration
const OPENAI_MODEL = 'gpt-4o'; // Can be changed to fine-tuned model
const MAX_TOKENS = 4096;

/**
 * Generate OpenAI Batch API request for a transformation
 */
function generateBatchRequest(
  customId: string,
  userPrompt: string
): OpenAIBatchRequest {
  return {
    custom_id: customId,
    method: 'POST',
    url: '/v1/chat/completions',
    body: {
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: TRANSFORMATION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      max_tokens: MAX_TOKENS,
    },
  };
}

/**
 * Save batch requests to JSONL file
 */
function saveBatchFile(requests: OpenAIBatchRequest[], batchName: string): string {
  const filePath = path.join(BATCH_PROMPTS_DIR, `${batchName}.jsonl`);

  const lines = requests.map(req => JSON.stringify(req)).join('\n') + '\n';
  fs.writeFileSync(filePath, lines, 'utf-8');

  return filePath;
}

/**
 * Main function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Batch Prompt Generator for Problem Transformation');
  console.log('═══════════════════════════════════════════════════════\n');

  // Ensure directories exist
  ensureDirectories();

  // Check if input files exist
  if (!fs.existsSync(INPUT_PROBLEMS_FILE)) {
    log(`Input file not found: ${INPUT_PROBLEMS_FILE}`, 'error');
    log('Please create input/problems.txt with problem IDs (one per line)', 'info');
    process.exit(1);
  }

  if (!fs.existsSync(INPUT_COMPANIES_FILE)) {
    log(`Input file not found: ${INPUT_COMPANIES_FILE}`, 'error');
    log('Please create input/companies.txt with company IDs (one per line)', 'info');
    process.exit(1);
  }

  // Read problem and company IDs
  log('Reading input files...', 'info');
  const problemIds = readProblemIds(INPUT_PROBLEMS_FILE);
  const companyIds = readCompanyIds(INPUT_COMPANIES_FILE);

  if (problemIds.length === 0) {
    log('No problem IDs found in input file', 'error');
    process.exit(1);
  }

  if (companyIds.length === 0) {
    log('No company IDs found in input file', 'error');
    process.exit(1);
  }

  log(`Found ${problemIds.length} problem(s)`, 'info');
  log(`Found ${companyIds.length} company(ies)`, 'info');

  // All roles
  const allRoles = Object.values(RoleFamily);
  log(`Processing ${allRoles.length} roles per combination`, 'info');

  // Calculate total combinations
  const totalCombinations = problemIds.length * companyIds.length * allRoles.length;
  log(`Total combinations: ${totalCombinations}`, 'info');

  if (totalCombinations === 0) {
    log('No transformations to generate', 'error');
    process.exit(1);
  }

  // Initialize transformation components
  log('Initializing transformation components...', 'info');
  const problemExtractor = new ProblemExtractor();
  const companyExtractor = new CompanyExtractor();
  const roleAnalyzer = new RoleAnalyzer();
  const analogyGenerator = new AnalogyGenerator();
  const promptGenerator = new RolePromptGenerator(roleAnalyzer);

  // Generate batch requests
  log('Generating transformation prompts...', 'info');
  const allRequests: OpenAIBatchRequest[] = [];
  let requestIndex = 0;
  let skippedCount = 0;

  for (const problemId of problemIds) {
    log(`Processing problem: ${problemId}`, 'info');

    // Fetch problem
    const problem = await getProblemById(problemId);
    if (!problem) {
      log(`  Problem not found: ${problemId}`, 'warn');
      skippedCount++;
      continue;
    }

    for (const companyId of companyIds) {
      // Fetch company
      const company = await getCompanyById(companyId);
      if (!company) {
        log(`  Company not found: ${companyId}`, 'warn');
        skippedCount++;
        continue;
      }

      // Extract problem and company info
      const problemInfo = problemExtractor.extractProblemInfo(problem);
      const companyInfo = companyExtractor.extractCompanyInfo(company, problemInfo.keywords);
      const relevanceScore = companyExtractor.calculateRelevanceScore(problemInfo, companyInfo);

      for (const roleFamily of allRoles) {
        requestIndex++;

        // Generate suggested analogy points with role context
        const suggestedAnalogyPoints = analogyGenerator.generateSuggestedAnalogyPoints(
          problemInfo,
          companyInfo,
          roleFamily
        );

        // Create transformation context
        const context = {
          problem: problemInfo,
          company: companyInfo,
          relevanceScore,
          suggestedAnalogyPoints,
        };

        // Generate role-enhanced prompt
        const userPrompt = promptGenerator.generateOptimizedPromptWithRole(context, roleFamily);

        // Create custom ID
        const customId = generateCustomId(problemId, companyId, roleFamily, requestIndex);

        // Create batch request
        const batchRequest = generateBatchRequest(customId, userPrompt);
        allRequests.push(batchRequest);

        if (requestIndex % 10 === 0) {
          log(`  Generated ${requestIndex}/${totalCombinations} prompts...`, 'info');
        }
      }
    }
  }

  log(`Successfully generated ${allRequests.length} prompts`, 'success');

  if (skippedCount > 0) {
    log(`Skipped ${skippedCount} invalid combinations`, 'warn');
  }

  // Split into batch files (max OPENAI_BATCH_LIMIT per file)
  const batches: OpenAIBatchRequest[][] = [];
  for (let i = 0; i < allRequests.length; i += OPENAI_BATCH_LIMIT) {
    batches.push(allRequests.slice(i, i + OPENAI_BATCH_LIMIT));
  }

  log(`Splitting into ${batches.length} batch file(s)`, 'info');

  // Save batch files
  let batchIndex = getNextBatchIndex();
  const savedFiles: string[] = [];

  for (const batchRequests of batches) {
    const batchName = generateBatchName(batchIndex);
    const filePath = saveBatchFile(batchRequests, batchName);
    savedFiles.push(filePath);

    log(`Created ${batchName}.jsonl with ${batchRequests.length} requests`, 'success');
    batchIndex++;
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Problems processed: ${problemIds.length}`);
  console.log(`Companies processed: ${companyIds.length}`);
  console.log(`Roles per combination: ${allRoles.length}`);
  console.log(`Total prompts generated: ${allRequests.length}`);
  console.log(`Batch files created: ${batches.length}`);
  console.log(`Output directory: ${BATCH_PROMPTS_DIR}`);

  if (savedFiles.length > 0) {
    console.log('\nGenerated files:');
    savedFiles.forEach(file => console.log(`  - ${path.basename(file)}`));

    console.log('\nNext steps:');
    console.log('  1. Review the generated JSONL files');
    console.log('  2. Run: npx tsx scripts/batch-problem-transform/batch-job-manager.ts submit');
  }

  console.log('═══════════════════════════════════════════════════════\n');
}

// Run main function
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
