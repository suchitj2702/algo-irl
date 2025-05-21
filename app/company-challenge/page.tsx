'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CodeEditor } from '@/components/code-editor';
import { Button } from '@/components/ui';
import { TestCase, Problem, TransformationResult } from '@/data-types/problem';
import { prepareCodeForSubmission } from '@/lib/code-execution/codeExecutionUtils';

// Define interface for test results from execution
interface TestResult {
  testCase: TestCase;
  passed: boolean;
  actualOutput: any;
  stdout?: string | null;
  stderr?: string | null;
  compileOutput?: string | null;
  status: string;
  judge0StatusId: number;
  time: number;
  memory: number;
  error?: string | null;
}

// Interface for execution results
interface ExecutionResults {
  passed: boolean;
  testCasesPassed: number;
  testCasesTotal: number;
  executionTime: number | null;
  memoryUsage: number | null;
  error?: string | null;
  testCaseResults: TestResult[];
}

// Predefined companies
const PREDEFINED_COMPANIES: Record<string, string> = {
  'Meta': 'meta',
  'Amazon': 'amazon',
  'Apple': 'apple',
  'Netflix': 'netflix',
  'Google': 'google',
  'Microsoft': 'microsoft',
  'OpenAI': 'openai',
};

// Difficulty levels
const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];

// Python is the only supported language
const LANGUAGE = 'python';

export default function CompanyChallengePage() {
  const router = useRouter();
  
  // State management
  const [isUsingPredefined, setIsUsingPredefined] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [customCompany, setCustomCompany] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('Medium');
  const [isBlind75, setIsBlind75] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transformedProblem, setTransformedProblem] = useState<TransformationResult | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [codeDetails, setCodeDetails] = useState<any>(null);
  const [code, setCode] = useState<string>('');
  const [executionResults, setExecutionResults] = useState<ExecutionResults | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [difficultyDropdownOpen, setDifficultyDropdownOpen] = useState(false);
  
  // Handle company selection
  const handleCompanySelect = (value: string) => {
    setSelectedCompany(value);
    setIsUsingPredefined(true);
    setDropdownOpen(false);
  };

  // Handle custom company input
  const handleCustomCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomCompany(e.target.value);
    setIsUsingPredefined(false);
  };

  // Handle difficulty selection
  const handleDifficultySelect = (value: string) => {
    setDifficulty(value);
    setDifficultyDropdownOpen(false);
  };

  // Handle code changes
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  // Toggle Blind75 selection
  const toggleBlind75 = () => {
    setIsBlind75(!isBlind75);
  };

  // Generate problem
  const generateProblem = async () => {
    setIsLoading(true);
    setError(null);
    setTransformedProblem(null);
    setSelectedProblem(null);
    setExecutionResults(null);
    setCodeDetails(null);

    try {
      // Get company ID (either from predefined or by creating a new one)
      let companyId: string;

      if (isUsingPredefined) {
        companyId = PREDEFINED_COMPANIES[selectedCompany];
        if (!companyId) {
          throw new Error('Please select a company');
        }
      } else {
        if (!customCompany.trim()) {
          throw new Error('Please enter a company name');
        }
        
        // Initialize custom company
        const companyResponse = await fetch('/api/companies/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyName: customCompany }),
        });

        if (!companyResponse.ok) {
          throw new Error('Failed to initialize company');
        }

        const companyData = await companyResponse.json();
        
        if (!companyData.success) {
          throw new Error(companyData.message || 'Failed to initialize company');
        }
        
        companyId = companyData.company.id;
      }

      // Use our new prepare API to handle problem selection, transformation, and code preparation
      const prepareResponse = await fetch('/api/problem/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          difficulty,
          companyId,
          isBlind75
        }),
      });
      
      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        throw new Error(errorData.error || 'Failed to prepare problem');
      }
      
      const responseData = await prepareResponse.json();
      
      // Set all the state from the response
      setSelectedProblem(responseData.problem);
      setTransformedProblem(responseData.transformedProblem);
      setCodeDetails(responseData.codeDetails);
      
      // Set default code from the response
      setCode(responseData.codeDetails.defaultUserCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
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
        const results = {
          passed: data.results?.passed || false,
          testCasesPassed: data.results?.testCasesPassed || 0,
          testCasesTotal: data.results?.testCasesTotal || 0,
          executionTime: data.results?.executionTime || null,
          memoryUsage: data.results?.memoryUsage || null,
          testCaseResults: data.results?.testResults || [],
        };
        
        setExecutionResults(results);
        setIsLoading(false);
        return;
      }
      
      // Handle error state
      if (data.status === 'error') {
        const errorResult = {
          passed: false,
          testCasesPassed: 0,
          testCasesTotal: selectedProblem?.testCases.length || 0,
          executionTime: null,
          memoryUsage: null,
          error: data.error || 'Execution failed',
          testCaseResults: []
        };
        setExecutionResults(errorResult);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Status polling error:', error);
      const errorResult = {
        passed: false,
        testCasesPassed: 0,
        testCasesTotal: selectedProblem?.testCases.length || 0,
        executionTime: null,
        memoryUsage: null,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        testCaseResults: []
      };
      setExecutionResults(errorResult);
      setIsLoading(false);
    }
  };

  // Execute code directly using the execute-code API
  const executeCode = async () => {
    if (!selectedProblem || !codeDetails) return;
    
    setIsLoading(true);
    setError(null);
    setExecutionResults(null);

    try {
      // Prepare the code for execution using our utility function
      let preparedCode;
      try {
        preparedCode = prepareCodeForSubmission(code, {
          functionMapping: transformedProblem?.functionMapping
        });
      } catch (error) {
        throw new Error(
          error instanceof Error 
            ? `Code preparation error: ${error.message}` 
            : 'Failed to prepare code for execution'
        );
      }
      
      // Submit directly to execute-code API
      const response = await fetch('/api/execute-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: preparedCode,
          language: LANGUAGE,
          problemId: selectedProblem.id
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
      setError(error instanceof Error ? error.message : 'An unknown error occurred during execution');
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Company-Specific Coding Challenge</h1>
      
      {!transformedProblem ? (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold mb-2">Generate a Company Challenge</h2>
            <p className="text-gray-600 mb-4">
              Select a company and difficulty level to generate a tailored coding challenge
            </p>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <div className="flex space-x-4">
                {/* Company dropdown */}
                <div className="relative w-[200px]">
                  <button
                    type="button"
                    className="flex items-center justify-between w-full px-4 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    <span>{selectedCompany || "Select a company"}</span>
                    <svg
                      className="w-5 h-5 ml-2 -mr-1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  
                  {dropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                      <ul className="py-1 overflow-auto text-sm max-h-56">
                        {Object.keys(PREDEFINED_COMPANIES).map(company => (
                          <li
                            key={company}
                            className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${company === selectedCompany ? 'bg-blue-100' : ''}`}
                            onClick={() => handleCompanySelect(company)}
                          >
                            {company}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                <span className="flex items-center">OR</span>
                
                <input 
                  type="text"
                  placeholder="Enter custom company name" 
                  value={customCompany}
                  onChange={handleCustomCompanyChange}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <div className="relative w-[200px]">
                <button
                  type="button"
                  className="flex items-center justify-between w-full px-4 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  onClick={() => setDifficultyDropdownOpen(!difficultyDropdownOpen)}
                >
                  <span>{difficulty}</span>
                  <svg
                    className="w-5 h-5 ml-2 -mr-1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                
                {difficultyDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                    <ul className="py-1 overflow-auto text-sm max-h-56">
                      {DIFFICULTY_LEVELS.map(level => (
                        <li
                          key={level}
                          className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${level === difficulty ? 'bg-blue-100' : ''}`}
                          onClick={() => handleDifficultySelect(level)}
                        >
                          {level}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            
            {/* Add Blind75 toggle after difficulty dropdown */}
            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBlind75}
                  onChange={toggleBlind75}
                  className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
                <span className="text-sm font-medium text-gray-700">
                  Blind 75 Problems Only
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Blind 75 is a curated list of the most important coding interview problems
              </p>
            </div>
          </div>
          
          <div className="mt-6">
            <Button 
              onClick={generateProblem} 
              disabled={isLoading}
              className={`${isLoading ? 'opacity-70 cursor-not-allowed' : ''} w-full md:w-auto`}
            >
              {isLoading ? (
                <>
                  <svg className="inline-block mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                "Generate Problem"
              )}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="mb-4">
              <h2 className="text-xl font-bold">{selectedProblem?.title}</h2>
              <p className="text-gray-600">
                {isUsingPredefined ? selectedCompany : customCompany} - {difficulty} Difficulty
              </p>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Company Scenario:</h3>
                <div className="whitespace-pre-wrap bg-gray-100 p-4 rounded-md">
                  {transformedProblem.scenario}
                </div>
              </div>
              
              {/* Function Mapping Section */}
              {transformedProblem.functionMapping && Object.keys(transformedProblem.functionMapping).length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Function/Class Mapping:</h3>
                  <div className="bg-gray-100 p-4 rounded-md">
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          <th className="text-left py-2 px-4 border-b">Original Name</th>
                          <th className="text-left py-2 px-4 border-b">Company-Specific Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(transformedProblem.functionMapping).map(([original, renamed], index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="py-2 px-4 border-b">{original}</td>
                            <td className="py-2 px-4 border-b">{renamed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {selectedProblem && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Problem Description:</h3>
                  <div className="whitespace-pre-wrap bg-gray-100 p-4 rounded-md">
                    {selectedProblem.description}
                  </div>
                  
                  {selectedProblem.constraints && selectedProblem.constraints.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium">Constraints:</h4>
                      <ul className="list-disc pl-5 mt-2">
                        {selectedProblem.constraints.map((constraint, index) => (
                          <li key={index}>{constraint}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {selectedProblem.testCases && selectedProblem.testCases.filter(tc => tc.isSample).length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium">Sample Test Cases:</h4>
                      <div className="space-y-3 mt-2">
                        {selectedProblem.testCases.filter(tc => tc.isSample).map((testCase, index) => (
                          <div key={index} className="bg-gray-100 p-3 rounded-md">
                            <div><strong>Input:</strong> {testCase.stdin}</div>
                            <div><strong>Output:</strong> {testCase.expectedStdout}</div>
                            {testCase.explanation && (
                              <div><strong>Explanation:</strong> {testCase.explanation}</div>
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
          
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-2">Your Python Solution</h2>
              <p className="text-gray-600">
                {codeDetails?.solutionStructureHint || 
                  selectedProblem?.languageSpecificDetails?.python?.solutionStructureHint || 
                  "Write your Python solution below:"}
              </p>
            </div>
            
            <div>
              <CodeEditor
                code={code}
                language="python"
                onChange={handleCodeChange}
                height="400px"
                width="100%"
              />
            </div>
            
            <div className="mt-4">
              <Button 
                onClick={executeCode} 
                disabled={isLoading}
                className={`${isLoading ? 'opacity-70 cursor-not-allowed' : ''} w-full md:w-auto`}
              >
                {isLoading ? (
                  <>
                    <svg className="inline-block mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                    </svg>
                    Running...
                  </>
                ) : (
                  "Run Code"
                )}
              </Button>
            </div>
          </div>
          
          {/* Execution results section - enhanced with detailed test information */}
          {executionResults && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="mb-4">
                <h2 className="text-xl font-bold mb-4">Execution Results</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="flex items-center">
                    <span className="font-medium mr-2">Status:</span> 
                    {executionResults.passed ? 
                      <span className="text-green-600 font-medium">All Tests Passed</span> : 
                      <span className="text-red-600 font-medium">Failed</span>
                    }
                  </div>
                  <div className="mt-2">
                    <span className="font-medium">Tests:</span> {executionResults.testCasesPassed} / {executionResults.testCasesTotal} passed
                  </div>
                </div>
                <div>
                  {executionResults.executionTime !== null && (
                    <div>
                      <span className="font-medium">Execution Time:</span> {executionResults.executionTime} ms
                    </div>
                  )}
                  {executionResults.memoryUsage !== null && (
                    <div>
                      <span className="font-medium">Memory Usage:</span> {(executionResults.memoryUsage / 1000).toFixed(2)} MB
                    </div>
                  )}
                </div>
              </div>
              
              {/* Display error if there is one */}
              {executionResults.error && (
                <div className="mb-6">
                  <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
                    <h3 className="font-medium mb-1">Error:</h3>
                    <pre className="whitespace-pre-wrap text-sm">{executionResults.error}</pre>
                  </div>
                </div>
              )}
              
              {/* Detailed test case results */}
              {executionResults.testCaseResults && executionResults.testCaseResults.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-3">Test Case Details:</h3>
                  <div className="space-y-4">
                    {executionResults.testCaseResults.map((result: TestResult, index: number) => (
                      <div 
                        key={index} 
                        className={`border rounded-lg ${result.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
                      >
                        <div className="p-4 border-b border-gray-200">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium">
                              Test #{index + 1}: 
                              <span className={result.passed ? 'text-green-600 ml-2' : 'text-red-600 ml-2'}>
                                {result.passed ? 'Passed' : 'Failed'}
                              </span>
                            </h4>
                            <div className="text-sm text-gray-500">
                              <span className="mr-3">Time: {result.time} ms</span>
                              <span>Memory: {(result.memory / 1000).toFixed(2)} MB</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-4 space-y-3">
                          {/* Input */}
                          <div>
                            <h5 className="text-sm font-medium mb-1">Input:</h5>
                            <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto max-h-28">
                              {typeof result.testCase.stdin === 'string' 
                                ? result.testCase.stdin 
                                : JSON.stringify(result.testCase.stdin, null, 2)}
                            </pre>
                          </div>
                          
                          {/* Expected Output */}
                          <div>
                            <h5 className="text-sm font-medium mb-1">Expected Output:</h5>
                            <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto max-h-28">
                              {typeof result.testCase.expectedStdout === 'string' 
                                ? result.testCase.expectedStdout
                                : JSON.stringify(result.testCase.expectedStdout, null, 2)}
                            </pre>
                          </div>
                          
                          {/* Actual Output - only shown for failed tests or if explicitly asked to see all */}
                          {(!result.passed || true) && (
                            <div>
                              <h5 className="text-sm font-medium mb-1">Actual Output:</h5>
                              <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto max-h-28">
                                {result.stdout || 
                                  (result.actualOutput !== null 
                                    ? (typeof result.actualOutput === 'string' 
                                        ? result.actualOutput 
                                        : JSON.stringify(result.actualOutput, null, 2))
                                    : "No output")}
                              </pre>
                            </div>
                          )}
                          
                          {/* Show stderr if present */}
                          {result.stderr && (
                            <div>
                              <h5 className="text-sm font-medium mb-1">Error Output:</h5>
                              <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto max-h-28 text-red-600">
                                {result.stderr}
                              </pre>
                            </div>
                          )}
                          
                          {/* Show test-specific error if present */}
                          {result.error && (
                            <div>
                              <h5 className="text-sm font-medium mb-1">Error:</h5>
                              <div className="text-red-600 text-sm">{result.error}</div>
                            </div>
                          )}
                          
                          {/* Show explanation if present */}
                          {result.testCase.explanation && (
                            <div>
                              <h5 className="text-sm font-medium mb-1">Explanation:</h5>
                              <div className="text-gray-700 text-sm">{result.testCase.explanation}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}