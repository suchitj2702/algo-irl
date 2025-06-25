import { TestCase } from './problem';

// Union type for possible test case outputs
export type TestCaseOutput = string | number | boolean | null | undefined | Array<unknown> | Record<string, unknown>;

export interface TestCaseResult {
  testCase: TestCase;
  passed: boolean;
  actualOutput: TestCaseOutput;
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
  testResults?: Array<{
    testCase: TestCase;
    passed: boolean;
    actualOutput: TestCaseOutput;
    stdout?: string | null;
    stderr?: string | null;
    compileOutput?: string | null;
    status: string;
    judge0StatusId: number;
    time: number;
    memory: number;
    error?: string | null;
  }>; // Detailed results for each test case
} 