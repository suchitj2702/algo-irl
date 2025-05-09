import { TestCase } from './problem';

export interface TestCaseResult {
  testCase: TestCase;
  passed: boolean;
  actualOutput: any;
}

export interface CodeExecutionRequest {
  code: string;
  language: string;
  testCases: TestCase[];
  timeLimit?: number;
  memoryLimit?: number;
}

export interface ExecutionResult {
  success: boolean;
  testResults: TestCaseResult[];
  executionTime: number;
  memoryUsage: number;
  error?: string;
}

export interface ExecutionResults {
  passed: boolean;
  testCasesPassed: number;
  testCasesTotal: number;
  executionTime: number | null; // milliseconds
  memoryUsage: number | null; // MB
  error: string | null;
  testResults?: TestCaseResult[]; // Detailed results for each test case
} 