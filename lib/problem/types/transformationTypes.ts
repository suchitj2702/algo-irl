/**
 * Type definitions for problem transformation pipeline
 */

import { ProblemDifficulty } from '@/data-types/problem';
import { RoleSpecificData } from '@/data-types/role';

/**
 * Represents extracted key information from a problem.
 * This is a simplified representation optimized for AI transformation.
 */
export interface ExtractedProblemInfo {
  title: string;
  difficulty: ProblemDifficulty;
  description: string;
  constraints: string[];
  categories: string[];
  timeComplexity: string | null;
  spaceComplexity: string | null;
  keywords: string[];
  coreAlgorithms: string[];
  dataStructures: string[];
  defaultUserCode?: string;
  testCases: {
    input: string;
    output: string;
  }[];
}

/**
 * Represents extracted key information from a company.
 * This focuses on aspects relevant to problem transformation.
 */
export interface ExtractedCompanyInfo {
  name: string;
  domain: string;
  products: string[];
  technologies: string[];
  interviewFocus: string[];
  relevantKeywords: string[];

  // Enhanced fields for richer context
  engineeringChallenges?: Record<string, string[]>;
  scaleMetrics?: Record<string, string>;
  techStackLayers?: Record<string, string[]>;
  problemDomains?: string[];
  industryBuzzwords?: string[];
  notableSystems?: string[];
  dataProcessingPatterns?: string[];
  optimizationPriorities?: string[];
  analogyPatterns?: Record<string, Array<{ context: string; analogy: string }>>;

  // Role-specific data passed through for transformation
  roleSpecificData?: Record<string, RoleSpecificData>;
}

/**
 * Represents enhanced prompt context combining problem and company information.
 * This is used to generate contextually relevant problem transformations.
 */
export interface TransformationContext {
  problem: ExtractedProblemInfo;
  company: ExtractedCompanyInfo;
  relevanceScore: number;
  suggestedAnalogyPoints: string[];
}

/**
 * Represents the structured sections of a transformed problem scenario.
 * This defines the expected output format for transformed problems.
 */
export interface StructuredScenario {
  title: string;
  background: string;
  problemStatement: string;
  functionSignature: string;
  constraints: string[];
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  requirements: string[];
  functionMapping: Record<string, string>;
}