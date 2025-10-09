/**
 * Hotness Calculator
 *
 * Calculates the "hotness" score (0-100) for each problem based on:
 * 1. Frequency (35%) - How often asked at the company
 * 2. Recency (25%) - How recently asked
 * 3. Role Relevance (25%) - Fit for the chosen role
 * 4. Company Context (15%) - Company-specific relevance
 *
 * The hotness score determines problem priority in study plans.
 */

import { Problem } from '@/data-types/problem';
import { Company } from '@/data-types/company';
import { RoleFamily } from '@/data-types/role';
import {
  CompanyProblemData,
  ProblemRoleScore,
  HotnessComponents,
  RecencyBucket,
  RECENCY_MULTIPLIERS,
  HOTNESS_WEIGHTS,
  EXTRAPOLATED_DEFAULTS
} from './types';
import { calculateCompanyContextBoost } from './companyContextAnalyzer';
import {
  ROLE_SCORE_THRESHOLDS
} from './adaptiveThresholds';

/**
 * Determine which recency buckets a problem appears in
 */
export function determineRecencyBuckets(
  problemSlug: string,
  companyProblems: Map<RecencyBucket, CompanyProblemData[]>
): RecencyBucket[] {
  const buckets: RecencyBucket[] = [];

  for (const [bucket, problems] of companyProblems.entries()) {
    if (problems.some(p => p.slug === problemSlug)) {
      buckets.push(bucket);
    }
  }

  return buckets;
}

/**
 * Calculate frequency component (0-1 scale)
 */
export function calculateFrequencyComponent(
  companyProblemData?: CompanyProblemData
): number {
  if (companyProblemData && companyProblemData.frequency) {
    // Normalize frequency (0-100) to 0-1 scale
    return companyProblemData.frequency / 100;
  }

  // Extrapolated problem - use default
  return EXTRAPOLATED_DEFAULTS.frequency;
}

/**
 * Calculate recency component (0-1 scale)
 */
export function calculateRecencyComponent(
  recencyBuckets: RecencyBucket[]
): number {
  if (recencyBuckets.length === 0) {
    // No recency data (extrapolated problem)
    return EXTRAPOLATED_DEFAULTS.recency;
  }

  // Take the highest recency score (most recent bucket)
  const scores = recencyBuckets.map(bucket => RECENCY_MULTIPLIERS[bucket]);
  return Math.max(...scores);
}

/**
 * Calculate role relevance component (0-1 scale)
 */
export function calculateRoleRelevanceComponent(
  roleScoreData: ProblemRoleScore,
  role: RoleFamily
): number {
  const roleScore = roleScoreData.roleScores[role];

  if (roleScore === undefined || roleScore === null) {
    // No role score data - use neutral default
    return 0.5;
  }

  // Normalize role score (0-100) to 0-1 scale
  return roleScore / 100;
}

/**
 * Calculate all hotness components for a problem
 */
export function calculateHotnessComponents(
  problem: Problem,
  company: Company,
  role: RoleFamily,
  companyProblemData: CompanyProblemData | undefined,
  roleScoreData: ProblemRoleScore,
  recencyBuckets: RecencyBucket[]
): HotnessComponents {
  // 1. Frequency component (35% weight)
  const frequencyComponent = calculateFrequencyComponent(companyProblemData);

  // 2. Recency component (25% weight)
  const recencyComponent = calculateRecencyComponent(recencyBuckets);

  // 3. Role relevance component (25% weight)
  const roleRelevanceComponent = calculateRoleRelevanceComponent(roleScoreData, role);

  // 4. Company context boost (15% weight)
  const contextAnalysis = calculateCompanyContextBoost(problem, company, roleScoreData);
  const companyContextBoost = contextAnalysis.overallBoost;

  return {
    frequencyComponent,
    recencyComponent,
    roleRelevanceComponent,
    companyContextBoost
  };
}

/**
 * Calculate final hotness score (0-100)
 */
export function calculateHotnessScore(
  components: HotnessComponents
): number {
  const weightedSum =
    components.frequencyComponent * HOTNESS_WEIGHTS.frequency +
    components.recencyComponent * HOTNESS_WEIGHTS.recency +
    components.roleRelevanceComponent * HOTNESS_WEIGHTS.roleRelevance +
    components.companyContextBoost * HOTNESS_WEIGHTS.companyContext;

  // Scale to 0-100 and round
  return Math.round(weightedSum * 100);
}

/**
 * Calculate hotness score breakdown (for API response)
 */
export function calculateHotnessBreakdown(
  components: HotnessComponents
): {
  frequency: number;
  recency: number;
  roleRelevance: number;
  companyContext: number;
} {
  return {
    frequency: Math.round(components.frequencyComponent * HOTNESS_WEIGHTS.frequency * 100),
    recency: Math.round(components.recencyComponent * HOTNESS_WEIGHTS.recency * 100),
    roleRelevance: Math.round(components.roleRelevanceComponent * HOTNESS_WEIGHTS.roleRelevance * 100),
    companyContext: Math.round(components.companyContextBoost * HOTNESS_WEIGHTS.companyContext * 100)
  };
}

/**
 * Complete hotness calculation for a single problem
 *
 * This is the main entry point for calculating hotness scores.
 */
export function calculateProblemHotness(
  problem: Problem,
  company: Company,
  role: RoleFamily,
  companyProblemData: CompanyProblemData | undefined,
  roleScoreData: ProblemRoleScore,
  companyProblems: Map<RecencyBucket, CompanyProblemData[]>
): {
  hotnessScore: number;
  components: HotnessComponents;
  breakdown: {
    frequency: number;
    recency: number;
    roleRelevance: number;
    companyContext: number;
  };
  isActuallyAsked: boolean;
  recencyBuckets: RecencyBucket[];
} {
  // Determine recency buckets
  const recencyBuckets = determineRecencyBuckets(problem.id, companyProblems);

  // Calculate components
  const components = calculateHotnessComponents(
    problem,
    company,
    role,
    companyProblemData,
    roleScoreData,
    recencyBuckets
  );

  // Calculate final score
  const hotnessScore = calculateHotnessScore(components);

  // Calculate breakdown for API response
  const breakdown = calculateHotnessBreakdown(components);

  return {
    hotnessScore,
    components,
    breakdown,
    isActuallyAsked: companyProblemData !== undefined,
    recencyBuckets
  };
}

/**
 * Batch calculate hotness scores for multiple problems
 *
 * Optimized for processing large problem sets.
 */
export function batchCalculateHotness(
  problems: Problem[],
  company: Company,
  role: RoleFamily,
  companyProblemMap: Map<string, CompanyProblemData>,
  roleScoreMap: Map<string, ProblemRoleScore>,
  companyProblems: Map<RecencyBucket, CompanyProblemData[]>,
  minRoleScore?: number
): Map<string, ReturnType<typeof calculateProblemHotness>> {
  const results = new Map<string, ReturnType<typeof calculateProblemHotness>>();

  // Determine minimum threshold for this role
  const thresholds = ROLE_SCORE_THRESHOLDS[role];
  const minThreshold = minRoleScore || thresholds.acceptable;

  for (const problem of problems) {
    const companyProblemData = companyProblemMap.get(problem.id);
    const roleScoreData = roleScoreMap.get(problem.id);

    if (!roleScoreData) {
      // Skip problems without role scores
      console.warn(`No role score data for problem: ${problem.id}`);
      continue;
    }

    // Apply role score threshold filtering
    const roleScore = roleScoreData.roleScores[role];
    if (roleScore < minThreshold) {
      // Problem doesn't meet minimum threshold for this role
      continue;
    }

    const result = calculateProblemHotness(
      problem,
      company,
      role,
      companyProblemData,
      roleScoreData,
      companyProblems
    );

    results.set(problem.id, result);
  }

  return results;
}

