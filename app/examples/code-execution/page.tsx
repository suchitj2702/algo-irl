'use client';

import { useState, useEffect } from 'react';
import type { Problem, TestCase } from '../../../data-types/problem';
import type { ExecutionResults } from '../../../data-types/execution';
import { CodeEditor } from '../../../components/code-editor';
import { LanguageSelector } from '../../../components/code-editor';

// Define problem types for the frontend
type ProblemListItem = {
  id: string;
  title: string;
  difficulty: string;
  categories: string[];
};

export default function SubmissionExamplePage() {
  // State for problems and UI
  const [problems, setProblems] = useState<ProblemListItem[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState<string>('');
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [results, setResults] = useState<ExecutionResults | null>(null);
  const [lastSubmission, setLastSubmission] = useState<{
    results: ExecutionResults;
    code: string;
    language: string;
    problemId: string;
  } | null>(null);

  // Fetch list of problems on component mount
  useEffect(() => {
    async function fetchProblems() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/problem');
        if (!response.ok) {
          throw new Error('Failed to fetch problems');
        }
        
        const problemList = await response.json();
        setProblems(problemList);
        
        // Select the first problem by default if available
        if (problemList.length > 0) {
          setSelectedProblemId(problemList[0].id);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching problems:', error);
        setLoadingError(error instanceof Error ? error.message : 'An unknown error occurred');
        setIsLoading(false);
      }
    }

    fetchProblems();
  }, []);

  // Fetch problem details when selected problem changes
  useEffect(() => {
    async function fetchProblemDetails() {
      if (!selectedProblemId) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/problem/${selectedProblemId}?language=${language}`);
        if (!response.ok) {
          throw new Error('Failed to fetch problem details');
        }
        
        const problemDetails = await response.json();
        setSelectedProblem(problemDetails);
        
        // Set initial code from problem details for selected language
        if (problemDetails.languageSpecificDetails && 
            problemDetails.languageSpecificDetails[language]) {
          setCode(problemDetails.languageSpecificDetails[language].defaultUserCode);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching problem details:', error);
        setLoadingError(error instanceof Error ? error.message : 'An unknown error occurred');
        setIsLoading(false);
      }
    }

    fetchProblemDetails();
  }, [selectedProblemId, language]);

  // Handle language change
  const handleLanguageChange = async (newLanguage: string) => {
    setLanguage(newLanguage);
    
    // Fetch problem details again with the new language
    if (selectedProblemId) {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/problem/${selectedProblemId}?language=${newLanguage}`);
        if (!response.ok) {
          throw new Error('Failed to fetch problem details for the selected language');
        }
        
        const problemDetails = await response.json();
        setSelectedProblem(problemDetails);
        
        // Update code with language-specific defaultUserCode
        if (problemDetails.languageSpecificDetails && 
            problemDetails.languageSpecificDetails[newLanguage]) {
          setCode(problemDetails.languageSpecificDetails[newLanguage].defaultUserCode);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching problem details for language:', error);
        setLoadingError(error instanceof Error ? error.message : 'An unknown error occurred');
        setIsLoading(false);
      }
    }
  };

  // Handle problem change
  const handleProblemChange = (problemId: string) => {
    setSelectedProblemId(problemId);
    setResults(null);
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  // Function to poll for execution results
  const pollForResults = async (submissionId: string) => {
    try {
      const response = await fetch(`/api/execute-code/status/${submissionId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch submission status');
      }
      
      const data = await response.json();
      
      // If submission is still processing, continue polling
      if (data.status === 'pending' || data.status === 'processing') {
        setTimeout(() => pollForResults(submissionId), 1000); // Poll every second
        return;
      }
      
      // If status is completed, update results
      if (data.status === 'completed') {
        setResults(data.results);
        setLastSubmission({ 
          results: data.results, 
          code, 
          language, 
          problemId: selectedProblemId 
        });
        setIsExecuting(false);
        return;
      }
      
      // Handle error state
      if (data.status === 'error') {
        const errorResult: ExecutionResults = {
          passed: false,
          testCasesPassed: 0,
          testCasesTotal: selectedProblem?.testCases.length || 0,
          executionTime: null,
          memoryUsage: null,
          error: data.error || 'Execution failed'
        };
        setResults(errorResult);
        setLastSubmission({ 
          results: errorResult, 
          code, 
          language, 
          problemId: selectedProblemId 
        });
        setIsExecuting(false);
      }
    } catch (error) {
      console.error('Status polling error:', error);
      const errorResult: ExecutionResults = {
        passed: false,
        testCasesPassed: 0,
        testCasesTotal: selectedProblem?.testCases.length || 0,
        executionTime: null,
        memoryUsage: null,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      };
      setResults(errorResult);
      setLastSubmission({ 
        results: errorResult, 
        code, 
        language, 
        problemId: selectedProblemId 
      });
      setIsExecuting(false);
    }
  };

  // Handle code execution
  const handleExecute = async () => {
    if (!code || !selectedProblemId || isExecuting) return;
    
    setIsExecuting(true);
    setResults(null);
    
    try {
      // Using the new execution API that supports problemId
      const response = await fetch('/api/execute-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          language,
          problemId: selectedProblemId,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute code');
      }
      
      const data = await response.json();
      // Start polling for results
      pollForResults(data.submissionId);
    } catch (error) {
      console.error('Submission error:', error);
      const errorResult: ExecutionResults = {
        passed: false,
        testCasesPassed: 0,
        testCasesTotal: selectedProblem?.testCases.length || 0,
        executionTime: null,
        memoryUsage: null,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      };
      setResults(errorResult);
      setLastSubmission({ 
        results: errorResult, 
        code, 
        language, 
        problemId: selectedProblemId 
      });
      setIsExecuting(false);
    }
  };

  // Loading state
  if (isLoading && !selectedProblem) {
    return (
      <div className="container mx-auto p-4 flex justify-center items-center h-screen">
        <div className="text-center">
          <p className="text-lg mb-2">Loading problems...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadingError) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 p-4 rounded-md border border-red-200">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p>{loadingError}</p>
        </div>
      </div>
    );
  }

  // Problem selector component
  function ProblemSelector() {
    return (
      <div className="relative w-full max-w-xs">
        <label htmlFor="problem-select" className="block text-sm font-medium text-gray-700 mb-1">
          Select Problem
        </label>
        <select
          id="problem-select"
          value={selectedProblemId}
          onChange={(e) => handleProblemChange(e.target.value)}
          className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          {problems.map((problem) => (
            <option key={problem.id} value={problem.id}>
              {problem.title} ({problem.difficulty})
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Display test cases component
  function TestCasesDisplay({ testCases }: { testCases: TestCase[] }) {
    return (
      <div className="mt-4 bg-gray-50 p-4 rounded-md">
        <h3 className="text-lg font-medium mb-2">Sample Test Cases</h3>
        <div className="space-y-3">
          {testCases.map((testCase, index) => (
            <div key={index} className="bg-white p-3 rounded-md border">
              <p className="font-medium text-sm">Test Case {index + 1}</p>
              <pre className="mt-1 text-xs overflow-auto p-2 bg-gray-50 rounded">
                <span className="font-medium">Input:</span> {testCase.stdin}
              </pre>
              <pre className="mt-1 text-xs overflow-auto p-2 bg-gray-50 rounded">
                <span className="font-medium">Expected Output:</span> {testCase.expectedStdout}
              </pre>
              {testCase.explanation && (
                <p className="mt-1 text-xs text-gray-600">
                  <span className="font-medium">Explanation:</span> {testCase.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">LeetCode-style Code Execution</h1>
        
        {selectedProblem && (
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <ProblemSelector />
              <div className="text-sm bg-gray-100 px-3 py-1 rounded mt-2 md:mt-0">
                Difficulty: <span className={`font-medium ${
                  selectedProblem.difficulty === 'Easy' ? 'text-green-600' :
                  selectedProblem.difficulty === 'Medium' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>{selectedProblem.difficulty}</span>
              </div>
            </div>
            
            <h2 className="text-xl font-semibold mb-4">{selectedProblem.title}</h2>
            <div className="mb-6 prose max-w-none">
              <p className="whitespace-pre-line">{selectedProblem.description}</p>
              {selectedProblem.constraints && selectedProblem.constraints.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-md font-medium">Constraints:</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {selectedProblem.constraints.map((constraint, index) => (
                      <li key={index}>{constraint}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {selectedProblem.testCases && selectedProblem.testCases.length > 0 && (
              <TestCasesDisplay testCases={selectedProblem.testCases} />
            )}
            
            <div className="code-execution-interface mt-6">
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <LanguageSelector
                      selectedLanguage={language}
                      onLanguageChange={handleLanguageChange}
                      className="w-48"
                    />
                    {selectedProblem.languageSpecificDetails[language] && (
                      <div className="mt-2 text-sm text-gray-600">
                        {selectedProblem.languageSpecificDetails[language].solutionStructureHint}
                      </div>
                    )}
                  </div>
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
                  height="400px"
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
                      <p><span className="font-medium">Memory usage:</span> {results.memoryUsage ? `${results.memoryUsage / 1000}MB` : 'N/A'}</p>
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
                            {result.testCase && result.testCase.name && (
                              <p className="text-sm font-medium">{result.testCase.name}</p>
                            )}
                            <div className="text-sm">
                              <span className="font-medium">Input:</span>
                              <code className="mt-1 text-xs overflow-auto p-1 bg-gray-100 rounded block">
                                {(() => {
                                  if (!result.testCase?.stdin) return 'N/A';
                                  try {
                                    const parsedStdin = JSON.parse(result.testCase.stdin);
                                    if (typeof parsedStdin === 'object' && parsedStdin !== null && !Array.isArray(parsedStdin)) {
                                      // Format as key: value on separate lines, but values are compact JSON
                                      return Object.entries(parsedStdin)
                                        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                                        .join('\n');
                                    }
                                    // Compact JSON for arrays/primitives
                                    return JSON.stringify(parsedStdin);
                                  } catch (e) {
                                    return result.testCase.stdin; // Fallback
                                  }
                                })()}
                              </code>
                            </div>
                            <div className="text-sm mt-1">
                              <span className="font-medium">Expected:</span>
                              <code className="mt-1 text-xs overflow-auto p-1 bg-gray-100 rounded block">
                                {(() => {
                                  if (!result.testCase?.expectedStdout) return 'N/A';
                                  try {
                                    const parsed = JSON.parse(result.testCase.expectedStdout);
                                    return JSON.stringify(parsed); // Compact JSON
                                  } catch (e) {
                                    return result.testCase.expectedStdout; // Fallback
                                  }
                                })()}
                              </code>
                            </div>
                            <div className="text-sm mt-1">
                              <span className="font-medium">Actual:</span> 
                              <code className="mt-1 text-xs overflow-auto p-1 bg-gray-100 rounded block">
                                {typeof result.actualOutput === 'object' && result.actualOutput !== null 
                                  ? JSON.stringify(result.actualOutput) // Compact JSON
                                  : String(result.actualOutput) 
                                }
                              </code>
                            </div>
                            {!result.passed && (
                              <p className="text-sm text-red-600 mt-1">
                                <span className="font-medium">Test failed</span>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {lastSubmission && lastSubmission.problemId === selectedProblemId && (
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
              <p>
                <strong>Memory Usage:</strong> {lastSubmission.results.memoryUsage ? `${lastSubmission.results.memoryUsage / 1000} MB` : 'N/A'}
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