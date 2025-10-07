/**
 * Batch script to compute role-specific scores for all problems
 *
 * This script analyzes each problem in the database and uses Claude Sonnet 4.5
 * to score its relevance to different engineering roles (Backend, ML, Frontend,
 * Infrastructure, Security). It also extracts enhanced topic information including
 * algorithm patterns and domain concepts.
 *
 * Usage:
 *   npx tsx scripts/compute-role-scores.ts [options]
 *
 * Options:
 *   --batch-size <number>    Number of problems to process in parallel (default: 10)
 *   --start-from <problemId> Resume from a specific problem ID
 *   --dry-run                Preview without saving to Firestore
 *   --force                  Recompute even if scores already exist
 *
 * Example:
 *   npx tsx scripts/compute-role-scores.ts --batch-size 20
 *   npx tsx scripts/compute-role-scores.ts --start-from two-sum --force
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

import { adminDb } from '../lib/firebase/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { getAllProblems } from '../lib/problem/problemDatastoreUtils';
import { executeLlmTask } from '../lib/llmServices/llmUtils';
import { Problem } from '../data-types/problem';
import { ProblemRoleScore, ROLE_SCORE_VERSION } from '../lib/study-plan/types';

// Parse command line arguments
const args = process.argv.slice(2);
const BATCH_SIZE = parseInt(args.find((arg, i) => args[i - 1] === '--batch-size') || '10');
const START_FROM = args.find((arg, i) => args[i - 1] === '--start-from');
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

/**
 * System prompt for role scoring task
 */
const ROLE_SCORING_SYSTEM_PROMPT = `You are an expert software engineering interviewer who deeply understands how different coding problems relate to various engineering roles.

Your task is to analyze algorithm problems and score their relevance to 5 engineering role families:
1. Backend/Systems: APIs, databases, distributed systems, caching, concurrency, scalability
2. ML/Data: Data pipelines, feature engineering, model optimization, ETL, data processing
3. Frontend/Full-stack: UI logic, state management, rendering optimization, client-side performance
4. Infrastructure/Platform: Resource scheduling, deployment, monitoring, container orchestration
5. Security/Reliability: Authentication, encryption, threat detection, fault tolerance, compliance

Be precise and differentiate clearly between roles based on the problem's core concepts, not just surface-level keywords.`;

/**
 * Generates the prompt for scoring a specific problem
 */
function generateRoleScoringPrompt(problem: Problem): string {
  return `Analyze this coding problem and score its relevance to different software engineering roles.

PROBLEM:
Title: ${problem.title}
Difficulty: ${problem.difficulty}
Categories: ${problem.categories.join(', ')}
Description: ${problem.description.substring(0, 1500)}${problem.description.length > 1500 ? '...' : ''}
${problem.solutionApproach ? `\nSolution Approach: ${problem.solutionApproach.substring(0, 800)}${problem.solutionApproach.length > 800 ? '...' : ''}` : ''}
${problem.timeComplexity ? `\nTime Complexity: ${problem.timeComplexity}` : ''}

TASK:
Score this problem's relevance to each role on a scale of 0-100, where:
- 0-20: Not relevant / fundamentally different focus
- 21-40: Tangentially related / rare use case
- 41-60: Moderately relevant / occasional application
- 61-80: Highly relevant / common in role
- 81-100: Core competency / central to role

Also extract/enhance:
1. Data Structures: List the primary data structures (use the categories field as a guide)
2. Algorithm Patterns: Specific algorithmic patterns (extract from solution approach and categories)
3. Domain Concepts: Real-world concepts this problem relates to (e.g., "Caching", "Rate Limiting", "Data Deduplication")
4. Complexity Class: Classify the time complexity (e.g., "Linear", "Logarithmic", "Quadratic", "Polynomial", "Exponential")
5. System Design Relevance: Does this problem relate to distributed systems or real-world system design? (true/false)

IMPORTANT:
- Be honest about low scores. Not every problem is relevant to every role.
- Use the provided solution approach and complexity to inform your analysis.
- Focus on what skills this problem actually tests, not what domain it's framed in.

Return ONLY valid JSON in this exact format:
{
  "roleScores": {
    "backend": 85,
    "ml": 30,
    "frontend": 20,
    "infrastructure": 60,
    "security": 40
  },
  "enrichedTopics": {
    "dataStructures": ["HashMap", "Array"],
    "algorithmPatterns": ["Two Pointers", "Hash Table Lookup"],
    "domainConcepts": ["Fast Retrieval", "Indexing"],
    "complexityClass": "Linear",
    "systemDesignRelevance": true
  }
}`;
}

/**
 * Check if a problem already has role scores computed
 */
async function getProblemRoleScore(problemId: string): Promise<ProblemRoleScore | null> {
  try {
    const db = adminDb();
    const docRef = db.collection('problemRoleScores').doc(problemId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data() as ProblemRoleScore;
      return {
        ...data,
        problemId: docSnap.id
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching role score for ${problemId}:`, error);
    return null;
  }
}

/**
 * Save problem role score to Firestore
 */
async function saveProblemRoleScore(score: ProblemRoleScore): Promise<void> {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would save role score for: ${score.problemId}`);
    return;
  }

  try {
    const db = adminDb();
    const docRef = db.collection('problemRoleScores').doc(score.problemId);
    await docRef.set({
      roleScores: score.roleScores,
      enrichedTopics: score.enrichedTopics,
      computedAt: score.computedAt,
      version: score.version
    });
    console.log(`✅ Saved role score for: ${score.problemId}`);
  } catch (error) {
    console.error(`❌ Error saving role score for ${score.problemId}:`, error);
    throw error;
  }
}

/**
 * Compute role score for a single problem using LLM
 */
async function computeRoleScoreForProblem(problem: Problem): Promise<ProblemRoleScore> {
  const prompt = generateRoleScoringPrompt(problem);

  try {
    const response = await executeLlmTask(
      'problemRoleScoring',
      prompt,
      ROLE_SCORING_SYSTEM_PROMPT
    );

    // Parse JSON response (handle markdown code blocks and extra text)
    let cleanedResponse = response.trim();

    // Remove markdown code blocks if present
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.substring(7);
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.substring(3);
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length - 3);
    }

    // Extract JSON object (first { to last })
    const firstBrace = cleanedResponse.indexOf('{');
    const lastBrace = cleanedResponse.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1);
    }

    cleanedResponse = cleanedResponse.trim();

    const parsed = JSON.parse(cleanedResponse);

    return {
      problemId: problem.id,
      roleScores: parsed.roleScores,
      enrichedTopics: parsed.enrichedTopics,
      computedAt: Timestamp.now(),
      version: ROLE_SCORE_VERSION
    };
  } catch (error) {
    console.error(`Error computing role score for ${problem.id}:`, error);
    throw error;
  }
}

/**
 * Process a batch of problems
 */
async function processBatch(problems: Problem[]): Promise<void> {
  const results = await Promise.allSettled(
    problems.map(async (problem) => {
      // Check if already exists
      const existing = await getProblemRoleScore(problem.id);

      if (existing && existing.version === ROLE_SCORE_VERSION && !FORCE) {
        console.log(`⏭️  Skipping ${problem.id} - already computed (v${existing.version})`);
        return;
      }

      if (existing && !FORCE) {
        console.log(`⏭️  Skipping ${problem.id} - already exists (use --force to recompute)`);
        return;
      }

      console.log(`🔄 Computing role score for: ${problem.id} (${problem.title})`);

      const score = await computeRoleScoreForProblem(problem);
      await saveProblemRoleScore(score);

      // Log the scores for visibility
      console.log(`   Scores: Backend=${score.roleScores.backend}, ML=${score.roleScores.ml}, Frontend=${score.roleScores.frontend}, Infra=${score.roleScores.infrastructure}, Security=${score.roleScores.security}`);
    })
  );

  // Report batch results
  const fulfilled = results.filter(r => r.status === 'fulfilled').length;
  const rejected = results.filter(r => r.status === 'rejected').length;

  console.log(`\n📊 Batch complete: ${fulfilled} succeeded, ${rejected} failed\n`);

  if (rejected > 0) {
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`   Error in ${problems[index].id}:`, result.reason);
      }
    });
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting role score computation...\n');
  console.log(`Configuration:`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  console.log(`  Start from: ${START_FROM || 'beginning'}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log(`  Force recompute: ${FORCE}`);
  console.log(`  Version: ${ROLE_SCORE_VERSION}\n`);

  // Fetch all problems
  console.log('📥 Fetching all problems from Firestore...');
  let problems = await getAllProblems();
  console.log(`✅ Loaded ${problems.length} problems\n`);

  // Filter to start from specific problem if requested
  if (START_FROM) {
    const startIndex = problems.findIndex(p => p.id === START_FROM);
    if (startIndex === -1) {
      console.error(`❌ Problem ${START_FROM} not found!`);
      process.exit(1);
    }
    problems = problems.slice(startIndex);
    console.log(`📍 Starting from problem: ${START_FROM} (${problems.length} remaining)\n`);
  }

  // Process in batches
  let processedCount = 0;
  const totalBatches = Math.ceil(problems.length / BATCH_SIZE);

  for (let i = 0; i < problems.length; i += BATCH_SIZE) {
    const batch = problems.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} problems)`);
    console.log(`${'='.repeat(60)}\n`);

    await processBatch(batch);

    processedCount += batch.length;

    // Rate limiting: wait 2 seconds between batches
    if (i + BATCH_SIZE < problems.length) {
      console.log(`⏳ Waiting 2 seconds before next batch...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✨ Role score computation complete!`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total problems processed: ${processedCount}`);
  console.log(`Total problems in database: ${problems.length}`);

  if (DRY_RUN) {
    console.log(`\n⚠️  DRY RUN MODE - No data was saved to Firestore`);
  }

  console.log(`\n✅ Script finished successfully!\n`);
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n⚠️  Script interrupted by user. Exiting gracefully...');
  process.exit(0);
});

// Run the script
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
