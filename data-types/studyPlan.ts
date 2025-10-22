import { Timestamp } from "firebase-admin/firestore";
import { RoleFamily } from './role';
import { Problem, ProblemDifficulty } from './problem';

/**
 * Study Plan Request and Response Types
 * These types define the API contract for the study plan generation system.
 */

/**
 * Request payload for generating a study plan
 */
export interface StudyPlanRequest {
  /** Company identifier (e.g., "google", "meta") */
  companyId: string;

  /** Engineering role family */
  roleFamily: RoleFamily;

  /** Number of days for the study plan (1-90) */
  timeline: number;

  /** Hours available per day (0.5-8) */
  hoursPerDay: number;

  /** Optional difficulty filters */
  difficultyPreference?: {
    easy?: boolean;
    medium?: boolean;
    hard?: boolean;
  };

  /** Optional specific topics to focus on */
  topicFocus?: string[];

  /** Optional flag to only include Blind75 problems */
  onlyBlind75?: boolean;
}

/**
 * Main study plan response
 */
export interface StudyPlanResponse {
  studyPlan: StudyPlan;
}

/**
 * Complete study plan structure
 */
export interface StudyPlan {
  /** Total number of problems in the plan */
  totalProblems: number;

  /** Estimated total hours to complete all problems */
  estimatedHours: number;

  /** Daily schedule with problem assignments */
  dailySchedule: DailyPlan[];

  /** Metadata about the plan */
  metadata: StudyPlanMetadata;
}

/**
 * Schedule for a single day
 */
export interface DailyPlan {
  /** Day number (1-indexed) */
  day: number;

  /** ISO 8601 date string */
  date: string;

  /** Problems assigned to this day */
  problems: EnrichedProblem[];

  /** Estimated hours for this day */
  estimatedHours: number;

  /** Unique topics covered in this day */
  topics: string[];
}

/**
 * Enhanced problem with scoring and metadata
 */
export interface EnrichedProblem {
  /** Problem identifier (slug) */
  problemId: string;

  /** Problem title */
  title: string;

  /** Difficulty level */
  difficulty: ProblemDifficulty;

  /** Overall hotness score (0-100) */
  hotnessScore: number;

  /** Breakdown of hotness score components */
  hotnessBreakdown: {
    /** Contribution from frequency component */
    frequency: number;

    /** Contribution from recency component */
    recency: number;

    /** Contribution from role relevance */
    roleRelevance: number;

    /** Contribution from company context */
    companyContext: number;
  };

  /** Company-specific frequency data */
  frequencyData: {
    /** Overall frequency rating (0-100) */
    overall: number;

    /** Time buckets where problem appears */
    recency: string[];  // e.g., ["thirtyDays", "threeMonths"]

    /** True if problem was actually asked at this company */
    isActuallyAsked: boolean;
  };

  /** Role relevance score (0-100) */
  roleRelevance: number;

  /** Enhanced topic information */
  enrichedTopics: {
    /** Data structures used */
    dataStructures: string[];

    /** Algorithm patterns */
    algorithmPatterns: string[];

    /** Domain-specific concepts */
    domainConcepts: string[];

    /** Complexity class */
    complexityClass: string;
  };

  /** Estimated time to complete (minutes) */
  estimatedTimeMinutes: number;

  /** Which day this problem is assigned to */
  dayAssigned: number;

  /** Optional: Pre-generated company-specific scenario */
  transformedScenario?: {
    title: string;
    background: string;
  };
}

/**
 * Metadata about the generated study plan
 */
export interface StudyPlanMetadata {
  /** Company name */
  companyName: string;

  /** Role family used for the plan */
  role: RoleFamily;

  /** When the plan was generated (ISO 8601) */
  generatedAt: string;

  /** Quality metrics for the plan */
  quality: StudyPlanQuality;
}

/**
 * Quality metrics for a study plan
 */
export interface StudyPlanQuality {
  /** Number of problems actually asked at the company */
  actualCompanyProblems: number;

  /** Number of problems extrapolated from problem bank */
  extrapolatedProblems: number;

  /** Number of unique topics covered */
  topicCoverage: number;
}

/**
 * Cached study plan document (Firestore)
 */
export interface StudyPlanCacheDocument {
  /** Document ID: "studyPlan-{companyId}-{role}-{timeline}-{hours}" */
  id: string;

  /** Cache key components */
  companyId: string;
  roleFamily: RoleFamily;
  timeline: number;
  hoursPerDay: number;

  /** The cached study plan */
  studyPlan: StudyPlan;

  /** Ordered list of problem IDs */
  problemIds: string[];

  /** Cache metadata */
  generatedAt: Timestamp;
  expiresAt: Timestamp;
  version: string;
}

/**
 * User filter preferences for problem selection
 */
export interface ProblemFilterPreferences {
  /** Difficulty filter */
  difficulties?: {
    easy?: boolean;
    medium?: boolean;
    hard?: boolean;
  };

  /** Specific topics to include */
  topics?: string[];

  /** Minimum hotness score */
  minHotnessScore?: number;

  /** Include only company problems */
  onlyCompanyProblems?: boolean;
}
