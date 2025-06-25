/**
 * Code execution configuration settings and types for the Judge0 integration.
 * This module defines all configuration options, throttling settings, and supported languages.
 */

/**
 * Supported programming languages for code execution.
 * These correspond to Judge0 language IDs and available language drivers.
 */
export type SupportedLanguage = 
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'csharp'
  | 'cpp'
  | 'go';

/**
 * Configuration settings for the code execution environment.
 * These settings control resource limits and execution behavior.
 */
export interface ExecutionConfig {
  /** Maximum execution time allowed in milliseconds */
  timeout: number;
  /** Maximum memory usage allowed in MB */
  memoryLimit: number;
  /** Maximum output size allowed in bytes */
  maxOutputSize: number;
  /** Whether network access is enabled during execution */
  enableNetwork: boolean;
  /** Maximum number of test cases allowed per execution */
  maxTestCases: number;
  /** Array of supported programming languages */
  supportedLanguages: SupportedLanguage[];
}

/**
 * Main configuration object for the code execution system.
 */
export interface CodeExecutionConfig {
  execution: ExecutionConfig;
}

/**
 * Throttling configuration for Judge0 API interactions.
 * These settings help manage rate limits and prevent API abuse.
 * 
 * Rate limiting strategy:
 * - Requests use exponential backoff when rate limited
 * - Batches are processed with delays between chunks
 * - Status checks have separate retry and delay configurations
 */
export interface CodeExecutionThrottlingConfig {
  /** Maximum number of retries for failed requests */
  requestMaxRetries: number;
  /** Initial delay in milliseconds before first retry */
  requestInitialDelayMs: number;
  /** Delay between individual submissions in single mode (ms) */
  singleSubmissionDelayMs: number;
  /** Maximum number of submissions per batch request */
  maxSubmissionsPerBatch: number;
  /** Delay between batch submissions (ms) */
  interBatchDelayMs: number;
  /** Maximum number of tokens per status check batch */
  maxTokensPerStatusBatch: number;
  /** Maximum retries for status check requests */
  statusCheckMaxRetries: number;
  /** Initial delay for status check retries (ms) */
  statusCheckInitialDelayMs: number;
  /** Delay between status check batches (ms) */
  interStatusBatchDelayMs: number;
}

/**
 * Default throttling configuration optimized for Judge0 API limits.
 * These values balance performance with rate limit compliance.
 */
export const defaultCodeExecutionThrottlingConfig: CodeExecutionThrottlingConfig = {
  requestMaxRetries: 3,
  requestInitialDelayMs: 100,
  singleSubmissionDelayMs: 100,
  maxSubmissionsPerBatch: 20, // Judge0 batch limit
  interBatchDelayMs: 500,
  maxTokensPerStatusBatch: 20, // Judge0 status batch limit
  statusCheckMaxRetries: 5, // Status checks may need more retries
  statusCheckInitialDelayMs: 1500, // Longer initial delay for status checks
  interStatusBatchDelayMs: 500,
};

/**
 * Main code execution configuration with environment variable overrides.
 * Settings can be customized via environment variables for different deployment environments.
 */
const config: CodeExecutionConfig = {
  execution: {
    // Timeout for code execution in milliseconds
    timeout: process.env.CODE_EXECUTION_TIMEOUT 
      ? parseInt(process.env.CODE_EXECUTION_TIMEOUT, 10) 
      : 5000, // 5 second default timeout
    
    // Memory limit for code execution in MB
    memoryLimit: process.env.CODE_EXECUTION_MEMORY_LIMIT 
      ? parseInt(process.env.CODE_EXECUTION_MEMORY_LIMIT, 10) 
      : 128, // 128MB default memory limit
    
    // Maximum output size in bytes
    maxOutputSize: process.env.CODE_EXECUTION_MAX_OUTPUT_SIZE 
      ? parseInt(process.env.CODE_EXECUTION_MAX_OUTPUT_SIZE, 10) 
      : 1024 * 1024, // 1MB default output limit
    
    // Whether to enable network access in the execution environment
    enableNetwork: process.env.CODE_EXECUTION_ENABLE_NETWORK === 'true',
    
    // Max number of test cases allowed per execution
    maxTestCases: process.env.CODE_EXECUTION_MAX_TEST_CASES 
      ? parseInt(process.env.CODE_EXECUTION_MAX_TEST_CASES, 10) 
      : 20, // 20 test cases default limit
    
    // Supported programming languages for code execution
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