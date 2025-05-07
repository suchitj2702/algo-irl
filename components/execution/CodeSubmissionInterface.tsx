'use client';

import { useState, useCallback } from 'react';
import { Button, useToast } from '../ui';
import { CodeEditorWithLanguageSelector } from '../CodeEditor';
import TestResultsDisplay from './TestResultsDisplay';
import type { ExecutionResults, TestCase, UserPreferences } from '../../types/entities';

interface CodeSubmissionInterfaceProps {
  problemId: string;
  testCases: TestCase[];
  initialCode?: string;
  initialLanguage?: string;
  preferences?: Partial<UserPreferences>;
  onComplete?: (results: ExecutionResults, code: string, language: string) => void;
}

export default function CodeSubmissionInterface({
  problemId,
  testCases,
  initialCode = '',
  initialLanguage = 'javascript',
  preferences,
  onComplete,
}: CodeSubmissionInterfaceProps) {
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState(initialLanguage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<ExecutionResults | null>(null);
  const { addToast } = useToast();

  // Handle code changes
  const handleCodeChange = useCallback((newCode: string, newLanguage: string) => {
    setCode(newCode);
    setLanguage(newLanguage);
  }, []);

  // Submit code for execution
  const handleSubmit = async () => {
    if (!code.trim()) {
      addToast('Please write some code before submitting', 'warning');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Make API call to execute code
      const response = await fetch('/api/code/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          language,
          problemId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute code');
      }

      const data = await response.json();
      
      // Update results
      setResults(data.results);
      
      // Show appropriate toast notification
      if (data.results.passed) {
        addToast('All tests passed successfully!', 'success');
      } else if (data.results.error) {
        addToast('Execution error: ' + data.results.error.substring(0, 50) + '...', 'error');
      } else {
        addToast(`${data.results.testCasesPassed}/${data.results.testCasesTotal} tests passed`, 'warning');
      }
      
      // Call the onComplete callback if provided
      if (onComplete) {
        onComplete(data.results, code, language);
      }
      
    } catch (error) {
      console.error('Error executing code:', error);
      addToast('Failed to execute code. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset code and results
  const handleReset = () => {
    const confirmReset = window.confirm('Are you sure you want to reset your code? This action cannot be undone.');
    if (confirmReset) {
      setCode('');
      setResults(null);
      addToast('Your code has been reset', 'info');
    }
  };

  return (
    <div className="code-submission-container">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Code Editor</h2>
        <CodeEditorWithLanguageSelector
          initialCode={code}
          initialLanguage={language}
          onChange={handleCodeChange}
          height="50vh"
          preferences={preferences}
        />
      </div>
      
      <div className="flex space-x-4 mb-6">
        <Button
          variant="primary"
          isLoading={isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? 'Running Tests...' : 'Submit & Run Tests'}
        </Button>
        
        <Button
          variant="secondary"
          onClick={handleReset}
          disabled={isSubmitting || !code}
        >
          Reset Code
        </Button>
      </div>
      
      <div className="results-container">
        <TestResultsDisplay
          results={results}
          isLoading={isSubmitting}
          testCases={testCases}
        />
      </div>
    </div>
  );
} 