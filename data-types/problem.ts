import { Timestamp } from "firebase/firestore";

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
  solutionApproach?: string | null;
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TestCase {
  input: Record<string, any>;
  output: any;
  explanation?: string;
}

export interface ProblemTransformRequest {
  problemId: string;
  companyId: string;
  useCache?: boolean;
}

export interface TransformationResult {
  scenario: string;
  contextInfo: {
    detectedAlgorithms: string[];
    detectedDataStructures: string[];
    relevanceScore: number;
    suggestedAnalogyPoints: string[];
  }
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