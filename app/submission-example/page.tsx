'use client';

import { useState } from 'react';
import { CodeSubmissionInterface } from '../../components/execution';
import type { ExecutionResults, TestCase } from '../../types/entities';

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
const exampleSolutions = {
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

export default function SubmissionExamplePage() {
  const [lastSubmission, setLastSubmission] = useState<{
    results: ExecutionResults;
    code: string;
    language: string;
  } | null>(null);

  const handleComplete = (results: ExecutionResults, code: string, language: string) => {
    setLastSubmission({ results, code, language });
    // In a real app, you might save this to Firestore or perform other actions
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
          
          <CodeSubmissionInterface
            problemId="two-sum"
            testCases={mockTestCases}
            initialLanguage="javascript"
            onComplete={handleComplete}
          />
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