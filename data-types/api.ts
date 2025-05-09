import { ProblemTransformRequest, TransformationResult } from './problem';
import { TestCase } from './problem';
import { ExecutionResult } from './execution';

export interface ImportProblemRequest {
  url: string;
}

export interface ImportProblemResponse {
  success: boolean;
  slug?: string;
  error?: string;
}

export interface ImportProblemsRequest {
  urls: string[];
}

export interface ImportProblemsResponse {
  success: boolean;
  successCount: number;
  errors: Array<{
    url: string;
    error: string;
  }>;
}

export interface TransformRequest extends ProblemTransformRequest {}
export interface TransformResponse extends TransformationResult {}

export interface ExecuteCodeRequest {
  code: string;
  language: string;
  testCases: TestCase[];
  timeLimit?: number;
  memoryLimit?: number;
}

export interface ExecuteCodeResponse extends ExecutionResult {} 