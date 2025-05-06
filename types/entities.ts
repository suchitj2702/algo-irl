import { Timestamp } from "firebase/firestore";

export type ProblemDifficulty = "Easy" | "Medium" | "Hard";

export interface Problem {
  id: string; // Firestore document ID (matches problemId)
  title: string;
  difficulty: ProblemDifficulty;
  categories: string[]; // e.g., ["Array", "Hash Table"]
  description: string;
  constraints: string[]; // e.g., ["2 <= nums.length <= 10^4", ...]
  leetcodeLink?: string; // Optional link
  isBlind75: boolean;
  testCases: TestCase[];
  solutionApproach?: string | null;
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TestCase {
  input: Record<string, any>; // Flexible input structure
  output: any;
  explanation?: string;
}

export interface Company {
  id: string; // Firestore document ID (matches companyId)
  name: string;
  description: string;
  domain: string;
  products: string[];
  technologies: string[];
  interviewFocus: string[];
  logoUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Scenario {
  id: string; // Firestore document ID (matches scenarioId)
  problemId: string; // Reference to Problem document ID
  companyId: string; // Reference to Company document ID
  scenario: string; // Description of the scenario where the problem was asked
  createdAt: Timestamp;
  updatedAt: Timestamp;
  cacheExpiry?: Timestamp; // Optional cache expiry timestamp
}

// Added based on documentation.md
export interface User {
  uid: string; // Firestore document ID (matches Firebase Auth uid)
  email: string | null; // Can be null if using other providers
  displayName: string | null;
  photoURL: string | null;
  preferences: UserPreferences;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp; // Optional
}

export interface UserPreferences {
  theme: "light" | "dark";
  codeEditorTheme: string; // e.g., "vs-dark", "light"
  defaultLanguage: string; // e.g., "python", "javascript"
  fontSize: number;
  tabSize: number;
  showLineNumbers: boolean;
}

// Added based on documentation.md
export interface History {
  id: string; // Firestore document ID (matches historyId)
  userId: string; // Reference to User document ID (uid)
  problemId: string;
  companyId: string;
  scenarioId: string;
  code: string;
  language: string;
  executionResults: ExecutionResults;
  notes?: string;
  completed: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ExecutionResults {
  passed: boolean;
  testCasesPassed: number;
  testCasesTotal: number;
  executionTime: number | null; // milliseconds
  memoryUsage: number | null; // MB
  error: string | null;
} 