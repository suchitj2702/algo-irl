// Code execution config settings

/**
 * Configuration settings for the code execution environment
 * These can be overridden by environment variables
 */
const config = {
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

module.exports = config; 