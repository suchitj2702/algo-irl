/**
 * Study Plan Orchestrator
 *
 * Main coordinator for study plan generation.
 * Orchestrates the entire pipeline:
 * 1. Validate request and load company data
 * 2. Check cache for existing plan
 * 3. If cache miss:
 *    a. Select optimal problems (problemSelector)
 *    b. Generate daily schedule (scheduleGenerator)
 * 4. Save to cache (fire-and-forget)
 * 5. Return response
 *
 * **Note:** Problem transformations are NOT done here - they are fetched
 * on-demand when users click into individual problems via /api/problem/transform
 *
 * **Performance Target:**
 * - Cache hit: <100ms
 * - Cache miss: 1-2 seconds
 * - 95th percentile: <3 seconds
 */

import { StudyPlanRequest, StudyPlanResponse, EnrichedProblem } from '@/data-types/studyPlan';
import { getCompanyById } from '../company/companyUtils';
import { getCachedStudyPlan, cacheStudyPlan } from './cacheManager';
import { selectProblems } from './problemSelector';
import { generateSchedule, DailyPlanInternal } from './scheduleGenerator';
import { EnrichedProblemInternal, ProblemSelectionConfig } from './types';

/**
 * Validate study plan request parameters
 * Ensures all inputs are within acceptable ranges
 */
function validateRequest(request: StudyPlanRequest): {
  valid: boolean;
  error?: string;
} {
  // Timeline validation (1-90 days)
  if (request.timeline < 1 || request.timeline > 90) {
    return {
      valid: false,
      error: 'Timeline must be between 1 and 90 days'
    };
  }

  // Hours per day validation (0.5-8 hours)
  if (request.hoursPerDay < 0.5 || request.hoursPerDay > 8) {
    return {
      valid: false,
      error: 'Hours per day must be between 0.5 and 8'
    };
  }

  // Difficulty preference validation
  if (request.difficultyPreference) {
    const { easy, medium, hard } = request.difficultyPreference;
    // At least one difficulty must be selected
    if (!easy && !medium && !hard) {
      return {
        valid: false,
        error: 'At least one difficulty level must be selected'
      };
    }
  }

  // Topic focus validation (max 5 topics)
  if (request.topicFocus && request.topicFocus.length > 5) {
    return {
      valid: false,
      error: 'Maximum 5 topics can be selected'
    };
  }

  return { valid: true };
}

/**
 * Calculate target number of problems based on timeline and hours
 *
 * Estimation:
 * - Easy: 20 min (base + variance: 15-25 min)
 * - Medium: 35 min (base + variance: 27-43 min)
 * - Hard: 60 min (base + variance: 45-75 min)
 * - Average: ~40 min per problem
 *
 * Formula: (timeline * hoursPerDay * 60) / 40 * safetyBuffer
 * Safety buffer of 0.85 (15% reduction) accounts for:
 * - Time estimate variance
 * - Difficulty distribution skew
 * - User break time
 */
function calculateTargetProblemCount(timeline: number, hoursPerDay: number): number {
  const totalMinutes = timeline * hoursPerDay * 60;
  const avgMinutesPerProblem = 40;
  const safetyBuffer = 0.85; // 15% reduction to prevent overflow
  const count = Math.floor(totalMinutes / avgMinutesPerProblem * safetyBuffer);

  // Ensure at least 5 problems, max 200 problems
  return Math.max(5, Math.min(200, count));
}

/**
 * Extract all unique topics from enriched problems
 * Combines data structures and algorithm patterns
 */
function extractUniqueTopics(problems: EnrichedProblemInternal[]): Set<string> {
  const topics = new Set<string>();
  for (const p of problems) {
    for (const t of p.enrichedTopics.dataStructures) topics.add(t);
    for (const t of p.enrichedTopics.algorithmPatterns) topics.add(t);
  }
  return topics;
}

/**
 * Convert internal enriched problems to API response format
 */
function convertToEnrichedProblems(
  problems: EnrichedProblemInternal[]
): EnrichedProblem[] {
  return problems.map(p => ({
    problemId: p.id,
    title: p.title,
    difficulty: p.difficulty,
    hotnessScore: p.hotnessScore,
    hotnessBreakdown: p.hotnessBreakdown,
    frequencyData: p.frequencyData,
    roleRelevance: p.roleRelevance,
    enrichedTopics: p.enrichedTopics,
    estimatedTimeMinutes: p.estimatedTimeMinutes,
    dayAssigned: p.dayAssigned || 0
    // Note: transformedScenario is optional and fetched on-demand
  }));
}

/**
 * Generate study plan (main entry point)
 *
 * @param request - Study plan request parameters
 * @returns Complete study plan with scheduled problems
 */
export async function generateStudyPlan(
  request: StudyPlanRequest
): Promise<StudyPlanResponse> {
  const startTime = Date.now();

  console.log(`\n${'='.repeat(80)}`);
  console.log('🎯 STUDY PLAN GENERATION');
  console.log('='.repeat(80));
  console.log(`Company: ${request.companyId}`);
  console.log(`Role: ${request.roleFamily}`);
  console.log(`Timeline: ${request.timeline} days`);
  console.log(`Hours/day: ${request.hoursPerDay}`);
  console.log('='.repeat(80) + '\n');

  // 1. Validate request
  const validation = validateRequest(request);
  if (!validation.valid) {
    throw new Error(`Invalid request: ${validation.error}`);
  }

  // 2. Check cache first (before loading company data to save latency)
  console.log('🔍 Checking cache...');
  const cached = await getCachedStudyPlan(request);
  if (cached) {
    const elapsed = Date.now() - startTime;
    console.log(`✅ Cache hit! Returning cached plan (${elapsed}ms)\n`);
    console.log('='.repeat(80) + '\n');
    return cached;
  }
  console.log('   Cache miss - generating fresh plan\n');

  // 3. Load company data (only if cache miss)
  console.log('📦 Loading company data...');
  const company = await getCompanyById(request.companyId);
  if (!company) {
    throw new Error(`Company not found: ${request.companyId}`);
  }
  console.log(`   ✅ Loaded: ${company.name}\n`);

  // 4. Calculate target problem count
  const targetCount = calculateTargetProblemCount(request.timeline, request.hoursPerDay);
  console.log(`🎯 Target: ${targetCount} problems\n`);

  // 5. Select problems
  const selectionConfig: ProblemSelectionConfig = {
    companyId: request.companyId,
    roleFamily: request.roleFamily,
    targetCount,
    difficultyFilter: request.difficultyPreference,
    topicFocus: request.topicFocus
  };

  const selectedProblems = await selectProblems(selectionConfig, company);

  if (selectedProblems.length === 0) {
    throw new Error('No problems found matching your criteria. Try adjusting filters.');
  }

  // 6. Generate schedule (returns DailyPlanInternal[] with dates, topics, etc.)
  const dailySchedule = generateSchedule(selectedProblems, request.timeline, request.hoursPerDay);

  // 7. Convert problems in each day to EnrichedProblem format
  const enrichedSchedule = dailySchedule.map(day => ({
    ...day,
    problems: convertToEnrichedProblems(day.problems)
  }));

  // 8. Calculate minimal quality metrics
  const actualCompanyProblems = selectedProblems.filter(p => p.frequencyData.isActuallyAsked).length;
  const extrapolatedProblems = selectedProblems.length - actualCompanyProblems;
  const totalEstimatedHours = selectedProblems.reduce((sum, p) => sum + p.estimatedTimeMinutes, 0) / 60;
  const allTopics = extractUniqueTopics(selectedProblems);

  // 9. Build response
  const response: StudyPlanResponse = {
    studyPlan: {
      totalProblems: selectedProblems.length,
      estimatedHours: totalEstimatedHours,
      dailySchedule: enrichedSchedule,
      metadata: {
        companyName: company.name,
        role: request.roleFamily,
        generatedAt: new Date().toISOString(),
        quality: {
          actualCompanyProblems,
          extrapolatedProblems,
          topicCoverage: allTopics.size
        }
      }
    }
  };

  // 10. Cache response (fire-and-forget)
  cacheStudyPlan(request, response);

  const elapsed = Date.now() - startTime;
  console.log(`\n✅ Study plan generated successfully in ${elapsed}ms`);
  console.log('='.repeat(80) + '\n');

  return response;
}
