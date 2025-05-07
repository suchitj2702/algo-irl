/**
 * Test script for verifying the code execution API
 * 
 * Usage:
 * node scripts/test-code-execution.js
 */
const axios = require('axios');

// Example JavaScript solution for Two Sum
const jsSolution = `
function solution(nums, target) {
  const map = new Map();
  
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    
    map.set(nums[i], i);
  }
  
  return [];
}
`;

// Example failing solution
const failingSolution = `
function solution(nums, target) {
  return [0, 0]; // Always returns wrong answer
}
`;

// Example solution with error
const errorSolution = `
function solution(nums, target) {
  // This will throw an error
  return nonExistentVariable;
}
`;

async function testCodeExecution() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3002';
  const apiUrl = `${baseUrl}/api/code/execute`;
  
  console.log(`Testing code execution API at ${apiUrl}\n`);
  
  // Test successful execution
  try {
    console.log('Testing successful solution...');
    const response = await axios.post(apiUrl, {
      code: jsSolution,
      language: 'javascript',
      problemId: 'two-sum'
    });
    
    console.log('Results:');
    console.log(`- Passed: ${response.data.results.passed}`);
    console.log(`- Tests passed: ${response.data.results.testCasesPassed}/${response.data.results.testCasesTotal}`);
    console.log(`- Execution time: ${response.data.results.executionTime}ms`);
    console.log(`- Memory usage: ${response.data.results.memoryUsage ? response.data.results.memoryUsage + 'MB' : 'N/A'}`);
    console.log('\n');
    
    // Test failing solution
    console.log('Testing failing solution...');
    const failingResponse = await axios.post(apiUrl, {
      code: failingSolution,
      language: 'javascript',
      problemId: 'two-sum'
    });
    
    console.log('Results:');
    console.log(`- Passed: ${failingResponse.data.results.passed}`);
    console.log(`- Tests passed: ${failingResponse.data.results.testCasesPassed}/${failingResponse.data.results.testCasesTotal}`);
    console.log(`- First test actual output:`, 
      failingResponse.data.results.testResults?.[0]?.actualOutput);
    console.log('\n');
    
    // Test error solution
    console.log('Testing solution with error...');
    const errorResponse = await axios.post(apiUrl, {
      code: errorSolution,
      language: 'javascript',
      problemId: 'two-sum'
    });
    
    console.log('Results:');
    console.log(`- Passed: ${errorResponse.data.results.passed}`);
    console.log(`- Error: ${errorResponse.data.results.error || 'None'}`);
    
    console.log('\nAll tests completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

testCodeExecution(); 