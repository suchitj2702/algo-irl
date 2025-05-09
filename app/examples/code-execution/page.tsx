'use client';

import { useState } from 'react';
import type { TestCase } from '../../../data-types/problem';
import type { ExecutionResults } from '../../../data-types/execution';
import { CodeEditor } from '../../../components/code-editor';
import { LanguageSelector } from '../../../components/code-editor';

// Mock test cases
const mockTestCases: TestCase[] = [
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

// Example solutions
const exampleSolutions: Record<string, string> = {
  javascript: `// Two Sum solution
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
}`,
  python: `# Two Sum solution
def solution(nums, target):
    num_map = {}
    
    for i, num in enumerate(nums):
        complement = target - num
        
        if complement in num_map:
            return [num_map[complement], i]
        
        num_map[num] = i
    
    return []`,
  java: `// Two Sum solution
public int[] solution(int[] nums, int target) {
    Map<Integer, Integer> map = new HashMap<>();
    
    for (int i = 0; i < nums.length; i++) {
        int complement = target - nums[i];
        
        if (map.containsKey(complement)) {
            return new int[] { map.get(complement), i };
        }
        
        map.put(nums[i], i);
    }
    
    return new int[0];
}`
};

// Function to execute code via API
async function executeCodeViaAPI(code: string, language: string, testCases: TestCase[]): Promise<ExecutionResults> {
  try {
    const response = await fetch('/api/execute-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, language, testCases }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to execute code');
    }
    
    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
}

export default function SubmissionExamplePage() {
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState(exampleSolutions.javascript);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<ExecutionResults | null>(null);
  const [lastSubmission, setLastSubmission] = useState<{
    results: ExecutionResults;
    code: string;
    language: string;
  } | null>(null);

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    // Update code if example solution exists for this language
    if (exampleSolutions[newLanguage]) {
      setCode(exampleSolutions[newLanguage]);
    }
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  const handleExecute = async () => {
    if (!code || isExecuting) return;
    
    setIsExecuting(true);
    setResults(null);
    
    try {
      // Use the API endpoint instead of direct function call
      const executionResults = await executeCodeViaAPI(code, language, mockTestCases);
      setResults(executionResults);
      setLastSubmission({ results: executionResults, code, language });
    } catch (error) {
      console.error('Execution error:', error);
      const errorResult: ExecutionResults = {
        passed: false,
        testCasesPassed: 0,
        testCasesTotal: mockTestCases.length,
        executionTime: null,
        memoryUsage: null,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      };
      setResults(errorResult);
      setLastSubmission({ results: errorResult, code, language });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Code Submission Example</h1>
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Two Sum</h2>
          <div className="mb-6 prose">
            <p>
              Given an array of integers <code>nums</code> and an integer <code>target</code>, return indices of the two numbers such that they add up to <code>target</code>.
            </p>
            <p>
              You may assume that each input would have exactly one solution, and you may not use the same element twice.
            </p>
            <p>
              You can return the answer in any order.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Example Solutions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border p-4 rounded">
                <h4 className="font-medium mb-2">JavaScript</h4>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                  {exampleSolutions.javascript}
                </pre>
              </div>
              <div className="border p-4 rounded">
                <h4 className="font-medium mb-2">Python</h4>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                  {exampleSolutions.python}
                </pre>
              </div>
              <div className="border p-4 rounded">
                <h4 className="font-medium mb-2">Java</h4>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                  {exampleSolutions.java}
                </pre>
              </div>
            </div>
          </div>
          
          <div className="code-execution-interface">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <LanguageSelector
                  selectedLanguage={language}
                  onLanguageChange={handleLanguageChange}
                  className="w-48"
                />
                <button
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className={`px-4 py-2 rounded-md font-medium ${
                    isExecuting 
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {isExecuting ? 'Executing...' : 'Run Code'}
                </button>
              </div>
              
              <CodeEditor
                code={code}
                language={language}
                onChange={handleCodeChange}
                height="300px"
                width="100%"
              />
            </div>
            
            {results && (
              <div className="bg-gray-50 border rounded-md p-4 mt-4">
                <h3 className="text-lg font-medium mb-2">Execution Results</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p><span className="font-medium">Status:</span> {results.passed ? 
                      <span className="text-green-600">Passed</span> : 
                      <span className="text-red-600">Failed</span>}
                    </p>
                    <p><span className="font-medium">Tests:</span> {results.testCasesPassed} / {results.testCasesTotal} passed</p>
                  </div>
                  <div>
                    <p><span className="font-medium">Execution time:</span> {results.executionTime ? `${results.executionTime}ms` : 'N/A'}</p>
                    <p><span className="font-medium">Memory usage:</span> {results.memoryUsage ? `${results.memoryUsage}MB` : 'N/A'}</p>
                  </div>
                </div>
                
                {results.error && (
                  <div className="mt-2">
                    <p className="font-medium text-red-600">Error:</p>
                    <pre className="mt-1 p-2 bg-red-50 text-red-700 rounded text-sm overflow-auto">
                      {results.error}
                    </pre>
                  </div>
                )}
                
                {results.testResults && results.testResults.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Test Case Results:</h4>
                    <div className="space-y-2">
                      {results.testResults.map((result, index) => (
                        <div key={index} className={`p-2 rounded ${result.passed ? 'bg-green-50' : 'bg-red-50'}`}>
                          <p className="font-medium">
                            Test {index + 1}: {result.passed ? 
                              <span className="text-green-600">Passed</span> : 
                              <span className="text-red-600">Failed</span>}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Input:</span> {JSON.stringify(result.testCase.input)}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Expected:</span> {JSON.stringify(result.testCase.output)}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Actual:</span> {JSON.stringify(result.actualOutput)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {lastSubmission && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Last Submission Stats</h2>
            <div className="prose">
              <p>
                <strong>Language:</strong> {lastSubmission.language}
              </p>
              <p>
                <strong>Passed:</strong> {lastSubmission.results.passed ? 'Yes' : 'No'}
              </p>
              <p>
                <strong>Tests Passed:</strong> {lastSubmission.results.testCasesPassed} / {lastSubmission.results.testCasesTotal}
              </p>
              <p>
                <strong>Execution Time:</strong> {lastSubmission.results.executionTime ? `${lastSubmission.results.executionTime} ms` : 'N/A'}
              </p>
              {lastSubmission.results.error && (
                <div className="mt-2">
                  <strong>Error:</strong>
                  <pre className="text-xs bg-red-50 text-red-800 p-2 rounded mt-1">
                    {lastSubmission.results.error}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 