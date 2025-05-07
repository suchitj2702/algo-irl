'use client';

import { Badge, LoadingSpinner } from '../ui';
import type { ExecutionResults, TestCase, TestCaseResult } from '../../types/entities';

interface TestResultsDisplayProps {
  results: ExecutionResults | null;
  isLoading: boolean;
  testCases?: TestCase[];
}

export default function TestResultsDisplay({
  results,
  isLoading,
  testCases = [],
}: TestResultsDisplayProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border">
        <LoadingSpinner size="lg" color="primary" />
        <p className="mt-2 text-gray-600">Running your code...</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg border text-center">
        <p className="text-gray-600">Your code execution results will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="text-lg font-semibold">Execution Results</h3>
        <Badge 
          variant={results.passed ? 'success' : 'error'}
        >
          {results.passed ? 'All Tests Passed' : 'Tests Failed'}
        </Badge>
      </div>

      <div className="p-4 bg-gray-50">
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="bg-white p-3 rounded border">
            <p className="text-sm text-gray-500">Test Cases</p>
            <p className="font-medium">{results.testCasesPassed} / {results.testCasesTotal} Passed</p>
          </div>
          <div className="bg-white p-3 rounded border">
            <p className="text-sm text-gray-500">Execution Time</p>
            <p className="font-medium">{results.executionTime ? `${results.executionTime} ms` : 'N/A'}</p>
          </div>
          <div className="bg-white p-3 rounded border">
            <p className="text-sm text-gray-500">Memory Usage</p>
            <p className="font-medium">{results.memoryUsage ? `${results.memoryUsage} MB` : 'N/A'}</p>
          </div>
          <div className="bg-white p-3 rounded border">
            <p className="text-sm text-gray-500">Status</p>
            <p className="font-medium">{results.error ? 'Error' : 'Success'}</p>
          </div>
        </div>

        {results.error && (
          <div className="mt-4 bg-red-50 p-3 rounded-md border border-red-200">
            <h4 className="text-sm font-medium text-red-800 mb-1">Error</h4>
            <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono">{results.error}</pre>
          </div>
        )}

        {/* Use detailed test results when available */}
        {results.testResults && results.testResults.length > 0 ? (
          <div className="mt-4">
            <h4 className="font-medium mb-2">Test Cases</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {results.testResults.map((result, index) => {
                const testCase = result.testCase;
                const passed = result.passed;
                return (
                  <div 
                    key={index}
                    className={`p-3 rounded border ${passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h5 className="font-medium">Test Case #{index + 1}</h5>
                      <Badge 
                        variant={passed ? 'success' : 'error'}
                      >
                        {passed ? 'Passed' : 'Failed'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm mb-1">
                      <div>
                        <span className="text-gray-600">Input:</span> 
                        <pre className="text-xs mt-1 bg-white p-1 rounded overflow-x-auto">{JSON.stringify(testCase.input, null, 2)}</pre>
                      </div>
                      <div>
                        <span className="text-gray-600">Expected:</span>
                        <pre className="text-xs mt-1 bg-white p-1 rounded overflow-x-auto">{JSON.stringify(testCase.output, null, 2)}</pre>
                      </div>
                      <div>
                        <span className="text-gray-600">Your Output:</span>
                        <pre className={`text-xs mt-1 bg-white p-1 rounded overflow-x-auto ${!passed ? 'text-red-600 font-bold' : ''}`}>
                          {JSON.stringify(result.actualOutput, null, 2)}
                        </pre>
                      </div>
                    </div>
                    {testCase.explanation && (
                      <div className="text-xs italic text-gray-600 mt-1">{testCase.explanation}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : testCases.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">Test Cases</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {testCases.map((testCase, index) => {
                const isPassing = index < results.testCasesPassed;
                return (
                  <div 
                    key={index}
                    className={`p-3 rounded border ${isPassing ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h5 className="font-medium">Test Case #{index + 1}</h5>
                      <Badge 
                        variant={isPassing ? 'success' : 'error'}
                      >
                        {isPassing ? 'Passed' : 'Failed'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-1">
                      <div>
                        <span className="text-gray-600">Input:</span> 
                        <pre className="text-xs mt-1 bg-white p-1 rounded overflow-x-auto">{JSON.stringify(testCase.input, null, 2)}</pre>
                      </div>
                      <div>
                        <span className="text-gray-600">Expected:</span>
                        <pre className="text-xs mt-1 bg-white p-1 rounded overflow-x-auto">{JSON.stringify(testCase.output, null, 2)}</pre>
                      </div>
                    </div>
                    {testCase.explanation && (
                      <div className="text-xs italic text-gray-600 mt-1">{testCase.explanation}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 