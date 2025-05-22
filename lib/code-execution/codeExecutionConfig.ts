// Code execution config settings

/**
 * Configuration settings for the code execution environment
 * These can be overridden by environment variables
 */

export type SupportedLanguage = 
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'csharp'
  | 'cpp'
  | 'go';

export interface ExecutionConfig {
  timeout: number;
  memoryLimit: number;
  maxOutputSize: number;
  enableNetwork: boolean;
  maxTestCases: number;
  supportedLanguages: SupportedLanguage[];
}

export interface CodeExecutionConfig {
  execution: ExecutionConfig;
}

export interface CodeExecutionThrottlingConfig {
  requestMaxRetries: number;
  requestInitialDelayMs: number;
  singleSubmissionDelayMs: number;
  maxSubmissionsPerBatch: number;
  interBatchDelayMs: number;
  maxTokensPerStatusBatch: number;
  statusCheckMaxRetries: number;
  statusCheckInitialDelayMs: number;
  interStatusBatchDelayMs: number;
}

export const defaultCodeExecutionThrottlingConfig: CodeExecutionThrottlingConfig = {
  requestMaxRetries: 3,
  requestInitialDelayMs: 100,
  singleSubmissionDelayMs: 100,
  maxSubmissionsPerBatch: 20,
  interBatchDelayMs: 500,
  maxTokensPerStatusBatch: 20,
  statusCheckMaxRetries: 5,
  statusCheckInitialDelayMs: 1500,
  interStatusBatchDelayMs: 500,
};

const config: CodeExecutionConfig = {
  execution: {
    // Timeout for code execution in milliseconds
    timeout: process.env.CODE_EXECUTION_TIMEOUT 
      ? parseInt(process.env.CODE_EXECUTION_TIMEOUT, 10) 
      : 5000,
    
    // Memory limit for code execution in MB
    memoryLimit: process.env.CODE_EXECUTION_MEMORY_LIMIT 
      ? parseInt(process.env.CODE_EXECUTION_MEMORY_LIMIT, 10) 
      : 128,
    
    // Maximum output size in bytes
    maxOutputSize: process.env.CODE_EXECUTION_MAX_OUTPUT_SIZE 
      ? parseInt(process.env.CODE_EXECUTION_MAX_OUTPUT_SIZE, 10) 
      : 1024 * 1024, // 1MB
    
    // Whether to enable network access in the execution environment
    enableNetwork: process.env.CODE_EXECUTION_ENABLE_NETWORK === 'true',
    
    // Max number of test cases allowed per execution
    maxTestCases: process.env.CODE_EXECUTION_MAX_TEST_CASES 
      ? parseInt(process.env.CODE_EXECUTION_MAX_TEST_CASES, 10) 
      : 20,
    
    // Supported programming languages
    supportedLanguages: [
      'javascript',
      'typescript',
      'python',
      'java',
      'csharp',
      'cpp',
      'go'
    ]
  }
};

export default config; 