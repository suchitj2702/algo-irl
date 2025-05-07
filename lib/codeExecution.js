// Code execution utility for AlgoIRL
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const { executeInSandbox } = require('./sandboxing/vm');
const { executeInNodeVm } = require('./sandboxing/nodeVm');
const config = require('./config');

// Import language-specific configurations
const languageConfigs = require('./languageConfigs');

// Get execution settings from config
const EXECUTION_TIMEOUT = config.execution.timeout;
const MAX_BUFFER = config.execution.maxOutputSize;

/**
 * Executes code in a secure sandbox environment
 * @param {string} code - User submitted code
 * @param {string} language - Programming language
 * @param {Array} testCases - Test cases to run against
 * @returns {Object} Execution results
 */
async function executeCode(code, language, testCases) {
  // Create a unique ID for this execution
  const executionId = uuidv4();
  
  // Get language configuration
  const langConfig = languageConfigs[language];
  if (!langConfig) {
    throw new Error(`Unsupported language: ${language}`);
  }
  
  try {
    // Validate code for security
    const validatedCode = langConfig.validateCode(code);
    
    // Generate wrapper code with test cases
    const wrapperCode = langConfig.generateWrapperCode(validatedCode, testCases);
    
    // Execute in sandbox
    const sandboxResult = await executeSandboxed(wrapperCode, language, executionId);
    
    // Parse results
    let results;
    try {
      // Extract the JSON results from the output
      const outputLines = sandboxResult.output.trim().split('\n');
      
      // Find a line that looks like valid JSON
      const jsonLine = outputLines.find(line => {
        const trimmed = line.trim();
        return (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
               (trimmed.startsWith('[') && trimmed.endsWith(']'));
      });
      
      if (jsonLine) {
        try {
          const parsedResults = JSON.parse(jsonLine);
          results = {
            passed: parsedResults.passed || false,
            testCasesPassed: parsedResults.testCasesPassed || 0,
            testCasesTotal: testCases.length,
            executionTime: parsedResults.executionTime || sandboxResult.metrics?.executionTime || null,
            memoryUsage: sandboxResult.metrics?.memoryUsage || null,
            error: null,
            testResults: parsedResults.testResults || []
          };
        } catch (jsonError) {
          console.error('JSON parsing error:', jsonError.message);
          throw new Error(`Invalid JSON format: ${jsonError.message}`);
        }
      } else {
        // If no JSON-like line was found, look for any error messages
        const errorLine = outputLines.find(line => line.includes('ERROR:'));
        const errorMessage = errorLine ? errorLine.replace('ERROR:', '').trim() : 'Could not parse execution results';
        
        throw new Error(errorMessage);
      }
    } catch (parseError) {
      console.error('Error parsing execution results:', parseError);
      
      // Check if the output contains any useful error information
      const output = sandboxResult.output || '';
      const errorMatch = output.match(/ERROR: (.*?)(\n|$)/);
      const errorMessage = errorMatch ? errorMatch[1] : parseError.message;
      
      results = {
        passed: false,
        testCasesPassed: 0,
        testCasesTotal: testCases.length,
        executionTime: sandboxResult.metrics?.executionTime || null,
        memoryUsage: sandboxResult.metrics?.memoryUsage || null,
        error: errorMessage || 'Error parsing execution results',
      };
    }
    
    return results;
    
  } catch (error) {
    console.error('Code execution error:', error);
    
    // Determine the appropriate error message
    let errorMessage;
    if (error.message && error.message.includes('Script execution timed out')) {
      errorMessage = `Execution timed out after ${EXECUTION_TIMEOUT / 1000} seconds`;
    } else if (error.message && error.message.includes('Forbidden code pattern')) {
      errorMessage = error.message;
    } else if (error.message && error.message.includes('non-transferable value')) {
      errorMessage = 'Your solution includes objects that cannot be serialized or transferred. Try using simpler data structures.';
    } else {
      errorMessage = error.message || 'An unknown error occurred during execution';
    }
    
    return {
      passed: false,
      testCasesPassed: 0,
      testCasesTotal: testCases.length,
      executionTime: null,
      memoryUsage: null,
      error: errorMessage,
    };
  }
}

/**
 * Executes code in the sandbox
 * @param {string} code - Code to execute
 * @param {string} language - Programming language
 * @param {string} executionId - Unique ID for this execution
 * @returns {Object} Sandbox execution result
 */
async function executeSandboxed(code, language, executionId) {
  // Execute JavaScript using Node's built-in VM instead of isolated-vm
  if (language === 'javascript') {
    try {
      return await executeInNodeVm(code, {
        timeout: EXECUTION_TIMEOUT,
        sandbox: {}
      });
    } catch (err) {
      console.error('Node VM execution error:', err);
      // Fall back to isolated-vm if nodeVm fails
      return await executeInSandbox(code, {
        timeout: EXECUTION_TIMEOUT,
        sandbox: {}
      });
    }
  }
  
  // For other languages, this would call an external service
  // This is a placeholder to be replaced with a real implementation
  // that connects to containerized language-specific execution services
  return {
    output: `{"passed":false,"testCasesPassed":0,"testCasesTotal":0,"error":"Sandbox execution for ${language} is not implemented yet. Use the JavaScript sandbox for testing."}`,
    error: null,
    metrics: {
      executionTime: 0,
      memoryUsage: 0
    }
  };
}

module.exports = {
  executeCode
}; 