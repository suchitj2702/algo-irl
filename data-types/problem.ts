import { Timestamp } from "firebase-admin/firestore";

export type ProblemDifficulty = "Easy" | "Medium" | "Hard";

export interface Problem {
  id: string;
  title: string;
  difficulty: ProblemDifficulty;
  categories: string[];
  description: string;
  constraints: string[];
  leetcodeLink?: string;
  isBlind75: boolean;
  testCases: TestCase[];
  languageSpecificDetails: Record<string, LanguageSpecificProblemDetails>;
  solutionApproach?: string | null;
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TestCase {
  stdin: string;
  expectedStdout: string;
  explanation?: string;
  isSample?: boolean;
  name?: string;
  maxCpuTimeLimit?: number;
  maxMemoryLimit?: number;
}

export interface LanguageSpecificProblemDetails {
  solutionFunctionNameOrClassName: string;
  solutionStructureHint: string;
  boilerplateCodeWithPlaceholder: string;
  defaultUserCode: string;
  optimizedSolutionCode: string;
}

export interface ProblemTransformRequest {
  problemId: string;
  companyId: string;
  roleFamily?: string; // RoleFamily enum value (optional in request, will be auto-selected if not provided)
  useCache?: boolean;
}

export interface TransformationResult {
  scenario: string;
  functionMapping: Record<string, string>;
  contextInfo: {
    detectedAlgorithms: string[];
    detectedDataStructures: string[];
    relevanceScore: number;
    suggestedAnalogyPoints: string[];
  };
  roleFamily: string; // RoleFamily enum value (always present - either provided or auto-selected)
  wasRoleAutoSelected?: boolean; // Indicates if role was automatically selected
}

export interface ProblemTransformation {
  problemId: string;
  companyId: string;
  scenario: string;
  functionMapping: Record<string, string>;
  contextInfo: {
    detectedAlgorithms: string[];
    detectedDataStructures: string[];
    relevanceScore: number;
    suggestedAnalogyPoints: string[];
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
} 

export interface Scenario {
  id: string;
  problemId: string;
  companyId: string;
  scenario: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  cacheExpiry?: Timestamp;
}

/**
 * Response type for the /api/problem/prepare endpoint.
 * This represents a fully prepared problem ready for presentation to the user.
 *
 * Role is always included in the response - either provided by the user or auto-selected
 * for diversity in problem transformations.
 */
export interface PreparedProblemResponse {
  problem: {
    id: string;
    title: string;
    difficulty: ProblemDifficulty;
    background: string;
    problemStatement: string;
    constraints: string[];
    examples: Array<{
      input: string;
      output: string;
      explanation?: string;
    }>;
    requirements: string[];
    testCases: TestCase[];
    leetcodeUrl?: string;
    categories: string[];
    timeComplexity?: string | null;
    spaceComplexity?: string | null;
  };
  codeDetails: {
    functionName: string;
    solutionStructureHint: string;
    defaultUserCode: string;
    boilerplateCode: string;
  };
  roleMetadata: {
    roleFamily: string; // RoleFamily enum value (always present)
    wasRoleAutoSelected: boolean; // True if role was auto-selected, false if user-provided
    contextInfo: {
      detectedAlgorithms: string[];
      detectedDataStructures: string[];
      relevanceScore: number;
      suggestedAnalogyPoints: string[];
    };
  };
} 