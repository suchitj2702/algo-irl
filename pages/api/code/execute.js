// API route for code execution
const { executeCode } = require('../../../lib/codeExecution');
const config = require('../../../lib/config');

// Mock function to fetch test cases for a problem
// In a real implementation, you would fetch from Firestore
async function fetchTestCasesForProblem(problemId) {
  // Mock test cases for the two-sum problem
  if (problemId === 'two-sum') {
    return [
      {
        input: { nums: [2, 7, 11, 15], target: 9 },
        output: [0, 1],
        explanation: "Because nums[0] + nums[1] = 2 + 7 = 9, we return [0, 1]."
      },
      {
        input: { nums: [3, 2, 4], target: 6 },
        output: [1, 2],
        explanation: "Because nums[1] + nums[2] = 2 + 4 = 6, we return [1, 2]."
      },
      {
        input: { nums: [3, 3], target: 6 },
        output: [0, 1],
        explanation: "Because nums[0] + nums[1] = 3 + 3 = 6, we return [0, 1]."
      }
    ];
  }
  
  return [];
}

/**
 * API handler for code execution
 * 
 * @param {Object} req - Next.js request object
 * @param {Object} res - Next.js response object
 */
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get request body
  const { code, language, problemId } = req.body;
  
  // Validate input
  if (!code || !language || !problemId) {
    return res.status(400).json({
      error: 'Missing required fields: code, language, or problemId'
    });
  }
  
  // Validate language is supported
  if (!config.execution.supportedLanguages.includes(language)) {
    return res.status(400).json({
      error: `Unsupported language: ${language}. Supported languages are: ${config.execution.supportedLanguages.join(', ')}`
    });
  }
  
  try {
    // Fetch test cases for the problem
    const testCases = await fetchTestCasesForProblem(problemId);
    
    if (testCases.length === 0) {
      return res.status(404).json({
        error: `No test cases found for problem: ${problemId}`
      });
    }
    
    // Check if test cases exceed the allowed limit
    if (testCases.length > config.execution.maxTestCases) {
      return res.status(400).json({
        error: `Too many test cases: ${testCases.length}. Maximum allowed: ${config.execution.maxTestCases}`
      });
    }
    
    // Execute the code in the sandbox
    const results = await executeCode(code, language, testCases);
    
    // Return the execution results
    return res.status(200).json({ results });
    
  } catch (error) {
    console.error('API route error:', error);
    
    return res.status(500).json({ 
      results: {
        passed: false,
        testCasesPassed: 0,
        testCasesTotal: 0,
        executionTime: null,
        memoryUsage: null,
        error: error.message || 'An error occurred processing your request',
      } 
    });
  }
} 