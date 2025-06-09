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
  }
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