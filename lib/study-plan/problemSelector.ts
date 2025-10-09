/**
 * Problem Selector
 *
 * Selects the optimal set of problems for a study plan by:
 * 1. Loading all problems and role scores
 * 2. Calculating hotness scores for each problem
 * 3. Applying user filters (difficulty, topics)
 * 4. Selecting diverse problems (maximize topic coverage)
 *
 * The selector balances hotness (priority) with diversity (broad coverage).
 */

import { Problem, ProblemDifficulty } from '@/data-types/problem';
import { Company } from '@/data-types/company';
import { adminDb } from '../firebase/firebaseAdmin';
import {
  ProblemRoleScore,
  CompanyProblemData,
  EnrichedProblemInternal,
  ProblemSelectionConfig,
  RecencyBucket,
  ESTIMATED_TIME_BY_DIFFICULTY
} from './types';
import { getAllProblems } from '../problem/problemDatastoreUtils';
import { batchCalculateHotness } from './hotnessCalculator';
import {
  getCachedAllProblems,
  cacheAllProblems,
  getCachedAllRoleScores,
  cacheAllRoleScores,
  getCachedCompanyProblems,
  cacheCompanyProblems
} from './requestCache';
import { normalizePatterns } from './patternNormalizer';
import {
  ROLE_SCORE_THRESHOLDS
} from './adaptiveThresholds';

/**
 * Load all problems with caching
 */
async function loadAllProblems(): Promise<Problem[]> {
  // Check cache first
  const cached = getCachedAllProblems();
  if (cached) {
    console.log('✅ Using cached problems');
    return cached;
  }

  // Cache miss - load from Firestore
  console.log('📥 Loading all problems from Firestore...');
  const problems = await getAllProblems();
  cacheAllProblems(problems);

  return problems;
}

/**
 * Load all role scores with caching
 */
async function loadAllRoleScores(): Promise<ProblemRoleScore[]> {
  // Check cache first
  const cached = getCachedAllRoleScores();
  if (cached) {
    console.log('✅ Using cached role scores');
    return cached;
  }

  // Cache miss - load from Firestore
  console.log('📥 Loading all role scores from Firestore...');
  const db = adminDb();
  const snapshot = await db.collection('problemRoleScores').get();

  const roleScores: ProblemRoleScore[] = [];
  snapshot.forEach(doc => {
    roleScores.push({
      id: doc.id,
      ...doc.data()
    } as ProblemRoleScore);
  });

  cacheAllRoleScores(roleScores);

  return roleScores;
}

/**
 * Load company problems from sub-collections with caching
 */
async function loadCompanyProblems(
  companyId: string
): Promise<Map<RecencyBucket, CompanyProblemData[]>> {
  // Check cache first
  const cached = getCachedCompanyProblems(companyId);
  if (cached) {
    console.log(`✅ Using cached company problems for ${companyId}`);
    return cached;
  }

  // Cache miss - load from Firestore
  console.log(`📥 Loading company problems for ${companyId} from Firestore...`);
  const db = adminDb();
  const companyRef = db.collection('companies-v2').doc(companyId);

  // Verify company document exists
  const companyDoc = await companyRef.get();
  if (!companyDoc.exists) {
    console.warn(`⚠️  Company document not found: companies-v2/${companyId}`);
    console.log(`   This means the company has no data yet. All problems will be extrapolated.`);
    return new Map(); // Return empty map - all problems will be extrapolated
  }

  console.log(`   ✅ Found company document: ${companyId}`);

  const buckets: RecencyBucket[] = [
    'thirtyDays',
    'threeMonths',
    'sixMonths',
    'moreThanSixMonths',
    'all'
  ];

  const companyProblems = new Map<RecencyBucket, CompanyProblemData[]>();

  // Data is stored in: companies-v2/{companyId}/problemsByPeriod/{periodKey}
  // Each document has a 'problems' array field
  await Promise.all(
    buckets.map(async bucket => {
      try {
        const periodDoc = await companyRef.collection('problemsByPeriod').doc(bucket).get();

        if (!periodDoc.exists) {
          companyProblems.set(bucket, []);
          return;
        }

        const data = periodDoc.data();
        const problemsArray = data?.problems || [];

        // Transform from Firestore format to CompanyProblemData format
        const problems: CompanyProblemData[] = problemsArray.map((p: { slug: string; frequency?: number; difficulty: string; topics?: string[] }) => ({
          slug: p.slug,
          frequency: p.frequency || 0,
          difficulty: p.difficulty,
          topics: p.topics || []
        }));

        companyProblems.set(bucket, problems);

        if (problems.length > 0) {
          console.log(`   ${bucket}: loaded ${problems.length} problems`);
        }
      } catch (error) {
        console.error(`   ❌ Error loading ${bucket}:`, error);
        companyProblems.set(bucket, []); // Set empty array on error
      }
    })
  );

  // Cache for future requests
  cacheCompanyProblems(companyId, companyProblems);

  return companyProblems;
}

/**
 * Simple hash function to generate deterministic pseudo-random number from string
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Estimate completion time for a problem based on difficulty
 * Time is deterministic based on problem ID (same problem always gets same time)
 */
function estimateTimeMinutes(problemId: string, difficulty: ProblemDifficulty): number {
  const config = ESTIMATED_TIME_BY_DIFFICULTY[difficulty];
  const variance = config.variance;

  // Use problem ID hash for deterministic variance
  const hash = hashString(problemId);
  const normalizedHash = (hash % 1000) / 1000; // Normalize to 0-1
  const randomOffset = (normalizedHash * 2 - 1) * variance; // Map to -variance to +variance

  return Math.round(config.base + randomOffset);
}

/**
 * Apply user filters to problems
 */
function applyFilters(
  problems: EnrichedProblemInternal[],
  config: ProblemSelectionConfig
): EnrichedProblemInternal[] {
  let filtered = problems;

  // Filter by difficulty
  if (config.difficultyFilter) {
    const { easy, medium, hard } = config.difficultyFilter;
    if (easy !== undefined || medium !== undefined || hard !== undefined) {
      filtered = filtered.filter(p => {
        if (p.difficulty === 'Easy' && easy) return true;
        if (p.difficulty === 'Medium' && medium) return true;
        if (p.difficulty === 'Hard' && hard) return true;
        return false;
      });
    }
  }

  // Filter by topic focus
  if (config.topicFocus && config.topicFocus.length > 0) {
    filtered = filtered.filter(p =>
      p.enrichedTopics.dataStructures.some(ds =>
        config.topicFocus!.some(tf => ds.toLowerCase().includes(tf.toLowerCase()))
      )
    );
  }

  // Filter by minimum hotness
  if (config.minHotnessScore) {
    filtered = filtered.filter(p => p.hotnessScore >= config.minHotnessScore!);
  }

  return filtered;
}

/**
 * Select diverse problems using greedy algorithm
 *
 * Algorithm:
 * 1. Start with problems sorted by hotness
 * 2. For each problem, calculate diversity bonus
 * 3. Select problem with highest (hotness + diversity bonus)
 * 4. Update covered topics/patterns
 * 5. Repeat until target count reached
 */
function selectDiverseProblems(
  problems: EnrichedProblemInternal[],
  targetCount: number,
  topicFocus?: string[]
): EnrichedProblemInternal[] {
  if (problems.length <= targetCount) {
    return problems;
  }

  // If user specified topic focus, don't apply diversity optimization
  if (topicFocus && topicFocus.length > 0) {
    return problems.slice(0, targetCount);
  }

  const selected: EnrichedProblemInternal[] = [];
  const coveredTopics = new Set<string>();
  const coveredPatterns = new Set<string>();
  const candidates = [...problems];

  while (selected.length < targetCount && candidates.length > 0) {
    // Calculate adjusted score (hotness + diversity bonus) for each candidate
    const scored = candidates.map(p => {
      const newTopics = p.enrichedTopics.dataStructures.filter(
        t => !coveredTopics.has(t)
      );
      const newPatterns = p.enrichedTopics.algorithmPatterns.filter(
        t => !coveredPatterns.has(t)
      );

      // Diversity bonus: 5 points per new topic/pattern (max 50)
      const diversityBonus = Math.min(50, (newTopics.length + newPatterns.length) * 5);

      return {
        problem: p,
        adjustedScore: p.hotnessScore + diversityBonus
      };
    });

    // Sort by adjusted score and pick the best
    scored.sort((a, b) => b.adjustedScore - a.adjustedScore);
    const best = scored[0].problem;

    selected.push(best);

    // Update covered topics/patterns
    best.enrichedTopics.dataStructures.forEach(t => coveredTopics.add(t));
    best.enrichedTopics.algorithmPatterns.forEach(t => coveredPatterns.add(t));

    // Remove from candidates
    const idx = candidates.indexOf(best);
    candidates.splice(idx, 1);
  }

  return selected;
}

/**
 * Main problem selection function
 *
 * This is the entry point for problem selection.
 *
 * @param config - Selection configuration
 * @param company - Target company
 * @param scope - Problem scope: 'company' (default) or 'all-problems' (generic pool)
 * @param allowNoThreshold - If true, accept problems with any role score (no threshold)
 */
export async function selectProblems(
  config: ProblemSelectionConfig,
  company: Company,
  scope: 'company' | 'all-problems' = 'company',
  allowNoThreshold: boolean = false
): Promise<EnrichedProblemInternal[]> {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🔍 PROBLEM SELECTION');
  console.log('='.repeat(60));
  console.log(`Company: ${company.name}`);
  console.log(`Role: ${config.roleFamily}`);
  console.log(`Target: ${config.targetCount} problems`);
  console.log(`Scope: ${scope}${allowNoThreshold ? ' (no threshold)' : ''}\n`);

  // 1. Load all data
  console.log('📦 Loading data...');
  const [allProblems, allRoleScores, companyProblems] = await Promise.all([
    loadAllProblems(),
    loadAllRoleScores(),
    loadCompanyProblems(config.companyId)
  ]);

  console.log(`   Problems: ${allProblems.length}`);
  console.log(`   Role scores: ${allRoleScores.length}`);

  // Debug: Show company data breakdown
  console.log('\n🔍 Company data breakdown:');
  let totalCompanyProblems = 0;
  for (const [bucket, problems] of companyProblems.entries()) {
    console.log(`   ${bucket}: ${problems.length} problems`);
    totalCompanyProblems += problems.length;
  }
  console.log(`   Total across all buckets: ${totalCompanyProblems}`);

  // Show sample data
  if (totalCompanyProblems > 0) {
    const firstBucketWithData = Array.from(companyProblems.entries()).find(([, probs]) => probs.length > 0);
    if (firstBucketWithData) {
      const [bucketName, problems] = firstBucketWithData;
      console.log(`\n🔍 Sample from ${bucketName}:`);
      console.log(`   First 3 slugs:`, problems.slice(0, 3).map(p => p.slug));
    }
  }

  console.log(`\n🔍 Sample problem IDs from main collection:`);
  console.log(`   First 3 IDs:`, allProblems.slice(0, 3).map(p => p.id));

  // 2. Create lookup maps for efficient access
  const roleScoreMap = new Map(allRoleScores.map(rs => [rs.id, rs]));

  // Build set of valid problem IDs to filter out "ghost problems"
  // (problems in company data that don't exist in main problems collection)
  const validProblemIds = new Set(allProblems.map(p => p.id));

  const companyProblemMap = new Map<string, CompanyProblemData>();
  let skippedGhosts = 0;
  const ghostExamples: string[] = [];

  for (const problems of companyProblems.values()) {
    for (const problem of problems) {
      // Only add company problems that exist in main problems collection
      if (validProblemIds.has(problem.slug)) {
        companyProblemMap.set(problem.slug, problem);
      } else {
        skippedGhosts++;
        if (ghostExamples.length < 5) {
          ghostExamples.push(problem.slug);
        }
      }
    }
  }

  if (skippedGhosts > 0) {
    console.log(`\n   ⚠️  Filtered out ${skippedGhosts} ghost problems from company data`);
    console.log(`   Sample ghosts:`, ghostExamples);
  }
  console.log(`   ✅ Valid company problems: ${companyProblemMap.size}`);

  // 3. Calculate hotness scores
  console.log('\n📊 Calculating hotness scores...');
  // If allowNoThreshold is true, pass undefined as minRoleScore to accept all problems
  const effectiveMinRoleScore = allowNoThreshold ? undefined : config.minRoleScore;
  const hotnessResults = batchCalculateHotness(
    allProblems,
    company,
    config.roleFamily,
    companyProblemMap,
    roleScoreMap,
    companyProblems,
    effectiveMinRoleScore
  );

  // 4. Enrich problems with all metadata
  const enrichedProblems: EnrichedProblemInternal[] = [];

  for (const problem of allProblems) {
    const hotnessResult = hotnessResults.get(problem.id);
    if (!hotnessResult) continue; // Skip if hotness calculation failed

    const roleScoreData = roleScoreMap.get(problem.id);
    if (!roleScoreData) {
      // No role scores - use neutral defaults instead of skipping
      console.warn(`No role score data for problem: ${problem.id}, using defaults`);
      enrichedProblems.push({
        ...problem,
        hotnessScore: hotnessResult.hotnessScore,
        hotnessBreakdown: hotnessResult.breakdown,
        frequencyData: {
          overall: companyProblemMap.get(problem.id)?.frequency || 30,
          recency: hotnessResult.recencyBuckets,
          isActuallyAsked: hotnessResult.isActuallyAsked
        },
        roleRelevance: 50, // Neutral default
        enrichedTopics: {
          dataStructures: [],
          algorithmPatterns: [],
          domainConcepts: [],
          complexityClass: 'Unknown'
        },
        estimatedTimeMinutes: estimateTimeMinutes(problem.id, problem.difficulty)
      });
      continue;
    }

    enrichedProblems.push({
      ...problem,
      hotnessScore: hotnessResult.hotnessScore,
      hotnessBreakdown: hotnessResult.breakdown,
      frequencyData: {
        overall: companyProblemMap.get(problem.id)?.frequency || 30,
        recency: hotnessResult.recencyBuckets,
        isActuallyAsked: hotnessResult.isActuallyAsked
      },
      roleRelevance: roleScoreData.roleScores[config.roleFamily],
      enrichedTopics: {
        dataStructures: roleScoreData.enrichedTopics.dataStructures,
        algorithmPatterns: normalizePatterns(
          roleScoreData.enrichedTopics.algorithmPatterns
        ),
        domainConcepts: roleScoreData.enrichedTopics.domainConcepts,
        complexityClass: roleScoreData.enrichedTopics.complexityClass
      },
      estimatedTimeMinutes: estimateTimeMinutes(problem.id, problem.difficulty)
    });
  }

  console.log(`   Enriched: ${enrichedProblems.length} problems`);

  // 5. Filter by scope
  let scopedProblems = enrichedProblems;
  if (scope === 'company') {
    // Only include problems that are actually asked at the company (or extrapolated with hotness > 0)
    scopedProblems = enrichedProblems.filter(p =>
      p.frequencyData.isActuallyAsked || p.hotnessScore > 0
    );
    console.log(`   After scope filter (company): ${scopedProblems.length} problems`);
  } else {
    // 'all-problems': Use entire problem pool
    console.log(`   Scope: all-problems (using entire database)`);
  }

  // 6. Sort by hotness (descending)
  scopedProblems.sort((a, b) => b.hotnessScore - a.hotnessScore);

  // 7. Apply filters
  console.log('\n🔧 Applying filters...');
  const filteredProblems = applyFilters(scopedProblems, config);
  console.log(`   After filters: ${filteredProblems.length} problems`);

  // 8. Select diverse problems
  console.log('\n🎯 Selecting diverse problems...');
  const selectedProblems = selectDiverseProblems(
    filteredProblems,
    config.targetCount,
    config.topicFocus
  );

  console.log(`   Selected: ${selectedProblems.length} problems`);

  // 9. Calculate statistics
  const actuallyAsked = selectedProblems.filter(p => p.frequencyData.isActuallyAsked).length;
  const avgHotness = selectedProblems.reduce((sum, p) => sum + p.hotnessScore, 0) / selectedProblems.length;
  const uniqueTopics = new Set(selectedProblems.flatMap(p => p.enrichedTopics.dataStructures));

  console.log(`\n📈 Statistics:`);
  console.log(`   Actually asked: ${actuallyAsked}`);
  console.log(`   Extrapolated: ${selectedProblems.length - actuallyAsked}`);
  console.log(`   Avg hotness: ${avgHotness.toFixed(1)}`);
  console.log(`   Unique topics: ${uniqueTopics.size}`);
  console.log('='.repeat(60) + '\n');

  return selectedProblems;
}

/**
 * Progressive fallback configuration
 */
interface FallbackStage {
  targetRatio: number;
  relaxTopics: boolean;
  relaxDifficulty: boolean;
  lowerThreshold: boolean;
  emergency: boolean;
  /** Problem scope: 'company' (default), 'all-problems' (generic pool) */
  scope?: 'company' | 'all-problems';
  /** Allow problems with no role score threshold (accept any problem) */
  allowNoThreshold?: boolean;
}

const FALLBACK_STAGES: FallbackStage[] = [
  // Stage 1: Strict - all filters, preferred threshold
  { targetRatio: 1.0, relaxTopics: false, relaxDifficulty: false, lowerThreshold: false, emergency: false, scope: 'company' },

  // Stage 2: Lower threshold early (before reducing target count)
  // Rationale: Better to get more problems at acceptable threshold than reduce target count
  { targetRatio: 0.8, relaxTopics: true, relaxDifficulty: false, lowerThreshold: true, emergency: false, scope: 'company' },

  // Stage 3: Lower threshold further (minimum threshold)
  { targetRatio: 0.6, relaxTopics: true, relaxDifficulty: true, lowerThreshold: true, emergency: false, scope: 'company' },

  // Stage 4-5: Original emergency fallback with company problems
  { targetRatio: 0.5, relaxTopics: true, relaxDifficulty: true, lowerThreshold: true, emergency: false, scope: 'company' },
  { targetRatio: 0.3, relaxTopics: true, relaxDifficulty: true, lowerThreshold: true, emergency: true, scope: 'company' },

  // Stage 6: Remove role score threshold entirely (company problems only)
  // Rationale: Better to include loosely-related problems from target company than leave days empty
  { targetRatio: 1.0, relaxTopics: true, relaxDifficulty: true, lowerThreshold: true, emergency: true, scope: 'company', allowNoThreshold: true },

  // Stage 7: Expand to entire problem database (generic pool)
  // Rationale: For long timelines (30+ days), we need to fill all days even if company has limited data
  { targetRatio: 1.0, relaxTopics: true, relaxDifficulty: true, lowerThreshold: true, emergency: true, scope: 'all-problems', allowNoThreshold: false },

  // Stage 8: Emergency - generic pool with no role threshold
  // Rationale: Last resort to prevent empty days (still respects difficulty preferences)
  { targetRatio: 1.0, relaxTopics: true, relaxDifficulty: true, lowerThreshold: true, emergency: true, scope: 'all-problems', allowNoThreshold: true },
];

/**
 * Select problems with progressive fallback
 * Tries increasingly relaxed constraints until sufficient problems are found
 */
export async function selectProblemsWithFallback(
  config: ProblemSelectionConfig,
  company: Company
): Promise<EnrichedProblemInternal[]> {
  const targetCount = config.targetCount;
  const minimumCount = config.minimumCount || 0;

  for (let i = 0; i < FALLBACK_STAGES.length; i++) {
    const stage = FALLBACK_STAGES[i];
    // CRITICAL: Never reduce target below minimum count (for timeline filling)
    const stageTarget = Math.max(
      minimumCount,
      Math.ceil(targetCount * stage.targetRatio)
    );

    console.log(`🔄 Fallback stage ${i + 1}/${FALLBACK_STAGES.length}: target=${stageTarget} (min=${minimumCount}), scope=${stage.scope || 'company'}, noThreshold=${stage.allowNoThreshold || false}`);

    // Create modified config for this stage
    const stageConfig: ProblemSelectionConfig = {
      ...config,
      targetCount: stageTarget,
      topicFocus: stage.relaxTopics ? undefined : config.topicFocus,
      difficultyFilter: stage.relaxDifficulty ? undefined : config.difficultyFilter,
    };

    // Adjust role threshold if needed
    if (stage.lowerThreshold && !stage.allowNoThreshold) {
      const thresholds = ROLE_SCORE_THRESHOLDS[config.roleFamily];
      // Override threshold in hotness calculator
      stageConfig.minRoleScore = stage.emergency ? thresholds.minimum : thresholds.acceptable;
    }

    try {
      const problems = await selectProblems(
        stageConfig,
        company,
        stage.scope || 'company',
        stage.allowNoThreshold || false
      );

      if (problems.length >= stageTarget) {
        console.log(`✅ Fallback stage ${i + 1} succeeded: ${problems.length} problems`);

        // Add metadata about relaxed constraints
        const metadata = {
          fallbackStage: i + 1,
          relaxedTopics: stage.relaxTopics,
          relaxedDifficulty: stage.relaxDifficulty,
          loweredThreshold: stage.lowerThreshold,
          emergency: stage.emergency,
          scope: stage.scope || 'company',
          allowedNoThreshold: stage.allowNoThreshold || false,
        };

        // Attach metadata to each problem (for frontend display)
        return problems.map(p => ({
          ...p,
          selectionMetadata: metadata,
        }));
      }

      console.log(`⚠️  Fallback stage ${i + 1} insufficient: ${problems.length}/${stageTarget} problems`);
    } catch (error) {
      console.error(`❌ Fallback stage ${i + 1} failed:`, error);
      // Continue to next stage
    }
  }

  throw new Error(`Failed to generate study plan even with emergency fallback (company: ${company.id}, role: ${config.roleFamily})`);
}
