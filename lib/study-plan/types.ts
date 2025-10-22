import { Timestamp } from "firebase-admin/firestore";
import { Problem, ProblemDifficulty } from '@/data-types/problem';
import { RoleFamily } from '@/data-types/role';

/**
 * Internal types for the study plan generation system
 * These types are used within the study-plan library modules.
 */

/**
 * Problem with role-specific scores (from problemRoleScores collection)
 */
export interface ProblemRoleScore {
  /** Problem identifier */
  id: string;

  /** Role-specific scores (0-100) */
  roleScores: {
    backend: number;
    ml: number;
    frontend: number;
    infrastructure: number;
    security: number;
  };

  /** Enhanced topic information extracted via LLM */
  enrichedTopics: {
    /** Data structures used in the problem */
    dataStructures: string[];

    /** Algorithm patterns (e.g., "Sliding Window", "Binary Search") */
    algorithmPatterns: string[];

    /** Domain-specific concepts (e.g., "Caching", "Rate Limiting") */
    domainConcepts: string[];

    /** Complexity class (e.g., "Linear", "Logarithmic") */
    complexityClass: string;

    /** Whether the problem relates to system design */
    systemDesignRelevance: boolean;
  };

  /** When the score was computed */
  computedAt: Timestamp;

  /** Version of the scoring algorithm used */
  version: string;
}

/**
 * Company problem data from sub-collections
 * Based on companies-v2 collection structure with sub-collections:
 * - thirtyDays, threeMonths, sixMonths, moreThanSixMonths, all
 */
export interface CompanyProblemData {
  /** Problem slug (identifier) */
  slug: string;

  /** Frequency rating (0-100) - how often this problem is asked */
  frequency: number;

  /** Difficulty level */
  difficulty: ProblemDifficulty;

  /** Problem topics/categories (data structures) */
  topics: string[];

  /** Which time buckets this problem appears in (optional, computed) */
  recencyBuckets?: string[];
}

/**
 * Enriched problem with all scoring metadata
 */
export interface EnrichedProblemInternal extends Problem {
  /** Overall hotness score (0-100) */
  hotnessScore: number;

  /** Breakdown of score components */
  hotnessBreakdown: {
    frequency: number;
    recency: number;
    roleRelevance: number;
    companyContext: number;
  };

  /** Company frequency data */
  frequencyData: {
    overall: number;
    recency: string[];
    isActuallyAsked: boolean;
  };

  /** Role relevance score */
  roleRelevance: number;

  /** Enhanced topics from role scoring */
  enrichedTopics: {
    dataStructures: string[];
    algorithmPatterns: string[];
    domainConcepts: string[];
    complexityClass: string;
  };

  /** Estimated completion time */
  estimatedTimeMinutes: number;

  /** Assigned day (set during scheduling) */
  dayAssigned?: number;

  /** Metadata about selection constraints (for frontend display) */
  selectionMetadata?: {
    fallbackStage: number;
    relaxedTopics: boolean;
    relaxedDifficulty: boolean;
    loweredThreshold: boolean;
    emergency: boolean;
  };
}

/**
 * Hotness score components (0-1 scale)
 */
export interface HotnessComponents {
  /** Frequency component (0-1) */
  frequencyComponent: number;

  /** Recency component (0-1) */
  recencyComponent: number;

  /** Role relevance component (0-1) */
  roleRelevanceComponent: number;

  /** Company context boost (0-1) */
  companyContextBoost: number;
}

/**
 * Company context analysis result
 */
export interface CompanyContextAnalysis {
  /** Tech stack overlap score (0-1) */
  techStackMatch: number;

  /** Domain concept match score (0-1) */
  domainConceptMatch: number;

  /** Industry buzzword match score (0-1) */
  buzzwordMatch: number;

  /** Overall context boost (0-1) */
  overallBoost: number;
}

/**
 * Problem selection configuration
 */
export interface ProblemSelectionConfig {
  /** Target number of problems to select */
  targetCount: number;

  /** Minimum number of problems needed to fill timeline (never reduce below this) */
  minimumCount?: number;

  /** Company ID */
  companyId: string;

  /** Role family */
  roleFamily: RoleFamily;

  /** Optional difficulty filters */
  difficultyFilter?: {
    easy?: boolean;
    medium?: boolean;
    hard?: boolean;
  };

  /** Optional topic focus */
  topicFocus?: string[];

  /** Minimum hotness score threshold */
  minHotnessScore?: number;

  /** Minimum role score threshold (for progressive fallback) */
  minRoleScore?: number;

  /** Optional flag to only include Blind75 problems */
  onlyBlind75?: boolean;
}

/**
 * Schedule generation configuration
 */
export interface ScheduleConfig {
  /** Total days for the schedule */
  timeline: number;

  /** Hours available per day */
  hoursPerDay: number;

  /** Whether to apply difficulty progression */
  applyDifficultyProgression?: boolean;

  /** Whether to space similar topics */
  applyTopicSpacing?: boolean;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Cache key */
  key: string;

  /** Time to live (milliseconds) */
  ttl: number;

  /** Cache version */
  version: string;
}

/**
 * Problem pool statistics
 */
export interface ProblemPoolStats {
  /** Total problems in pool */
  total: number;

  /** Problems from company data */
  fromCompanyData: number;

  /** Extrapolated problems */
  extrapolated: number;

  /** Unique topics covered */
  uniqueTopics: number;

  /** Difficulty distribution */
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };

  /** Average hotness score */
  avgHotnessScore: number;
}

/**
 * Recency bucket types
 */
export type RecencyBucket = 'thirtyDays' | 'threeMonths' | 'sixMonths' | 'moreThanSixMonths' | 'all';

/**
 * Recency multipliers for score calculation
 */
export const RECENCY_MULTIPLIERS: Record<RecencyBucket, number> = {
  thirtyDays: 1.0,
  threeMonths: 0.7,
  sixMonths: 0.4,
  moreThanSixMonths: 0.2,
  all: 0.5
};

/**
 * Hotness score weights
 */
export const HOTNESS_WEIGHTS = {
  frequency: 0.35,
  recency: 0.25,
  roleRelevance: 0.25,
  companyContext: 0.15
};

/**
 * Default values for extrapolated problems
 */
export const EXTRAPOLATED_DEFAULTS = {
  frequency: 0.3,
  recency: 0.3
};

/**
 * Estimated time by difficulty (minutes)
 */
export const ESTIMATED_TIME_BY_DIFFICULTY: Record<ProblemDifficulty, { base: number; variance: number }> = {
  Easy: { base: 20, variance: 5 },      // 15-25 minutes
  Medium: { base: 35, variance: 8 },    // 27-43 minutes
  Hard: { base: 60, variance: 15 }      // 45-75 minutes
};

/**
 * Cache version constant
 */
export const CACHE_VERSION = 'v1.0';

/**
 * Role score version constant
 */
export const ROLE_SCORE_VERSION = 'v1.0';
