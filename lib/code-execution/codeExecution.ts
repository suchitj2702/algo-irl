import { v4 as uuidv4 } from 'uuid';
import { Judge0Client, Judge0BatchSubmissionItem, Judge0SubmissionDetail } from './judge0Client';
import { getDriverDetails } from './languageConfigs';
import judge0Config from './judge0Config';
import { getProblemById } from '../problem/problemDatastoreUtils';

// Assuming TestCase is correctly imported from here.
// If not, the path might need adjustment based on your project structure.
import type { TestCase, Problem, LanguageSpecificProblemDetails } from '../../data-types/problem'; 

// Assuming ExecutionResults is correctly imported.
// Local definition for TestResult to avoid import issues for now.
// Ideally, TestResult would also come from a shared data-types definition.
import type { ExecutionResults } from '../../data-types/execution';

export interface TestResult {
  testCase: TestCase; // Original testCase input
  passed: boolean;
  actualOutput: any; // Parsed actual output (e.g., from JSON stdout)
  stdout?: string | null; // Raw stdout from Judge0
  stderr?: string | null; // Raw stderr from Judge0
  compileOutput?: string | null; // Compile output from Judge0
  status: string; // Judge0 status description (e.g., "Accepted", "Wrong Answer")
  judge0StatusId: number; // Judge0 status ID (e.g., 3 for Accepted)
  time: number; // Execution time in milliseconds
  memory: number; // Memory usage in kilobytes
  error?: string | null; // Aggregated error message for this test case
}

// Helper to create the full callback URL with submissionId
function getJudge0CallbackUrl(internalSubmissionId: string): string | undefined {
  if (process.env.NODE_ENV === 'production' && judge0Config.callbackUrl) {
    const separator = judge0Config.callbackUrl.includes('?') ? '&' : '?';
    return `${judge0Config.callbackUrl}${separator}submissionId=${internalSubmissionId}`;
  }
  return undefined;
}

export interface OrchestratedSubmissionInput {
  code: string;
  language: string; // e.g., "javascript", "python"
  testCases?: TestCase[]; // Optional when problemId is provided
  problemId?: string; // Optional for backward compatibility
}

export interface OrchestratedSubmissionOutput {
  internalSubmissionId: string;
  judge0Tokens: Array<{ token: string }>; 
}

/**
 * Combines user code with problem boilerplate by replacing the placeholder.
 */
export function combineUserCodeWithBoilerplate(userCode: string, boilerplate: string, language: string): string {
  // Define language-specific placeholders
  const placeholders: Record<string, string> = {
    'python': '# %%USER_CODE_PYTHON%%',
    'javascript': '// %%USER_CODE_JAVASCRIPT%%',
    'java': '// %%USER_CODE_JAVA%%',
    'cpp': '// %%USER_CODE_CPP%%',
  };

  // Get the placeholder for the specified language
  const placeholder = placeholders[language] || `%%USER_CODE_${language.toUpperCase()}%%`;
  
  // Trim leading/trailing whitespace from user code to prevent injection issues
  const trimmedUserCode = userCode.trim();

  // Replace the placeholder with the trimmed user's code
  // This assumes the placeholder in the boilerplate is at the correct indentation level (likely 0)
  // and the user code has consistent internal indentation.
  return boilerplate.replace(placeholder, trimmedUserCode);
}

/**
 * Orchestrates the submission of code to Judge0 as a batch.
 * Now supports both direct test cases and loading from problems.
 */
export async function orchestrateJudge0Submission(
  client: Judge0Client,
  submissionInput: OrchestratedSubmissionInput
): Promise<OrchestratedSubmissionOutput> {
  const { code, language, testCases, problemId } = submissionInput;
  let finalCode = code;
  let finalTestCases: TestCase[] = [];
  let maxCpuTimeLimit: number | undefined;
  let maxMemoryLimit: number | undefined;
  
  // If problemId is provided, load problem details and test cases from Firestore
  if (problemId) {
    const problem = await getProblemById(problemId);
    if (!problem) {
      throw new Error(`Problem with ID ${problemId} not found`);
    }
    
    // Get language-specific details
    const langDetails = problem.languageSpecificDetails[language];
    if (!langDetails) {
      throw new Error(`Language ${language} is not supported for problem ${problemId}`);
    }
    
    // Combine user code with boilerplate
    finalCode = combineUserCodeWithBoilerplate(
      code, 
      langDetails.boilerplateCodeWithPlaceholder,
      language
    );
    
    // Use problem test cases
    finalTestCases = problem.testCases;
    
  } else if (testCases && testCases.length > 0) {
    // If no problemId but testCases provided, use legacy mode
    finalTestCases = testCases;
    
    // In legacy mode, use the old driver template system
    const driverDetails = getDriverDetails(language);
    finalCode = driverDetails.driverTemplate.replace(
      driverDetails.userCodePlaceholder,
      code
    );
  } else {
    throw new Error('Either problemId or testCases must be provided');
  }

  const internalSubmissionId = uuidv4();
  const langId = getLanguageId(language); // Get language ID for Judge0

  const batchItems: Judge0BatchSubmissionItem[] = finalTestCases.map(testCase => {
    // Prepare input based on test case format
    const stdin = testCase.stdin;
    const expectedOutput = testCase.expectedStdout;

    console.log('expectedOutput', expectedOutput);
    
    const item: Judge0BatchSubmissionItem = {
      language_id: langId,
      source_code: finalCode,
      stdin: stdin,
      expected_output: expectedOutput,
    };
    
    // Add resource limits if provided
    if (maxCpuTimeLimit) {
      item.cpu_time_limit = maxCpuTimeLimit;
    }
    if (maxMemoryLimit) {
      item.memory_limit = maxMemoryLimit;
    }
    
    // Add test case specific limits if available
    if (testCase.maxCpuTimeLimit) {
      item.cpu_time_limit = testCase.maxCpuTimeLimit;
    }
    if (testCase.maxMemoryLimit) {
      item.memory_limit = testCase.maxMemoryLimit;
    }
    
    return item;
  });

  const callbackUrl = getJudge0CallbackUrl(internalSubmissionId);
  const judge0TokenResponses = await client.createBatchSubmissions(batchItems, callbackUrl);

  return {
    internalSubmissionId,
    judge0Tokens: judge0TokenResponses,
  };
}

/**
 * Helper function to get the Judge0 language ID from our language name.
 */
export function getLanguageId(language: string): number {
  const langConfig = judge0Config.languages[language as keyof typeof judge0Config.languages];
  if (!langConfig || typeof langConfig.id === 'undefined') {
    throw new Error(`Unsupported language or ID not configured in judge0Config: ${language}`);
  }
  return langConfig.id;
}

/**
 * Normalizes and compares two output strings.
 * Tries to parse them as JSON first, otherwise compares trimmed strings.
 */
function normalizeAndCompareOutputs(actual: string | null | undefined, expected: string | null | undefined): boolean {
  const normalizedActual = actual?.trim() ?? "";
  const normalizedExpected = expected?.trim() ?? "";

  // Handle cases where one or both are empty after trimming
  if (normalizedActual === "" && normalizedExpected === "") return true;
  if (normalizedActual === "" || normalizedExpected === "") return false; // Only one is empty

  try {
    // Attempt to parse both as JSON
    const parsedActual = JSON.parse(normalizedActual);
    const parsedExpected = JSON.parse(normalizedExpected);

    // Compare the stringified versions for deep comparison of objects/arrays
    // This handles differences in key order or whitespace within the JSON structure
    return JSON.stringify(parsedActual) === JSON.stringify(parsedExpected);

  } catch (e) {
    // If JSON parsing fails for either, fall back to trimmed string comparison
    return normalizedActual === normalizedExpected;
  }
}

/**
 * Aggregates results from multiple Judge0 submission details (for a batch)
 * into a single ExecutionResults object.
 */
export function aggregateBatchResults(
  judge0Details: Judge0SubmissionDetail[],
  originalTestCases: TestCase[] 
): ExecutionResults {
  let passedOverall = true;
  let totalTestCasesPassed = 0;
  const individualTestResults: TestResult[] = [];

  let maxTimeMs = 0;
  let maxMemoryKb = 0;
  let overallError: string | null = null; // For compilation or a critical runtime error affecting all

  // Check for compilation error first (applies to all test cases)
  const compilationErrorDetail = judge0Details.find(d => d.status.id === 6); // Status 6: Compilation Error
  if (compilationErrorDetail) {
    passedOverall = false;
    overallError = compilationErrorDetail.compile_output || compilationErrorDetail.stderr || compilationErrorDetail.message || "Compilation failed";
    
    // Populate all test results with compilation error
    for (let i = 0; i < originalTestCases.length; i++) {
      individualTestResults.push({
        testCase: originalTestCases[i],
        passed: false,
        actualOutput: null,
        stdout: compilationErrorDetail.stdout,
        stderr: compilationErrorDetail.stderr,
        compileOutput: compilationErrorDetail.compile_output,
        status: compilationErrorDetail.status.description,
        judge0StatusId: compilationErrorDetail.status.id,
        time: 0,
        memory: 0,
        error: overallError,
      });
    }
  } else {
    // Process individual test case results if no compilation error
    for (let i = 0; i < judge0Details.length; i++) {
      const detail = judge0Details[i];
      const originalTestCase = originalTestCases[i];

      const timeMs = detail.time ? parseFloat(detail.time) * 1000 : 0;
      const memoryKb = detail.memory || 0;

      if (timeMs > maxTimeMs) maxTimeMs = timeMs;
      if (memoryKb > maxMemoryKb) maxMemoryKb = memoryKb;

      let testPassed = false;
      let actualOutput: any = null;
      let currentTestError: string | null = null;
      let statusDescription = detail.status.description; // Start with original status
      let statusId = detail.status.id; // Start with original status ID

      console.log('Detail', detail);

      // Helper to parse stdout
      const parseStdout = (stdout: string | null | undefined): any => {
        if (!stdout) return stdout;
        const trimmedStdout = stdout.trim();
        if (trimmedStdout.startsWith('{') || trimmedStdout.startsWith('[')) {
          try {
            return JSON.parse(trimmedStdout);
          } catch {
            // Fallback to raw if JSON parsing fails
          }
        }
        return stdout; // Return raw (trimmed or original if not JSON-like)
      };

      if (detail.status.id === 3) { // Accepted initially
        testPassed = true;
        totalTestCasesPassed++;
        actualOutput = parseStdout(detail.stdout);
      } else { // Not accepted initially, let's re-check with normalization
        const normalizedMatch = normalizeAndCompareOutputs(detail.stdout, originalTestCase.expectedStdout);

        if (normalizedMatch) { // Outputs match after normalization!
          testPassed = true;
          totalTestCasesPassed++;
          statusDescription = "Accepted"; // Override status
          statusId = 3; // Override status ID
          currentTestError = null; // Clear potential error message
          actualOutput = parseStdout(detail.stdout); // Still parse the output
          // Do not set passedOverall = false for this case
        } else { // Outputs still don't match after normalization
          passedOverall = false; // Mark overall submission as failed
          currentTestError = detail.message || detail.status.description;
          if (detail.stderr) currentTestError += ` (Stderr: ${detail.stderr})`;
          // Keep original statusDescription and statusId
          if (!overallError && detail.status.id !== 4) { // Don't override with "Wrong Answer" if a more severe error exists
              overallError = currentTestError;
          }
          actualOutput = parseStdout(detail.stdout); // Parse the output even if failed
        }
      }

      individualTestResults.push({
        testCase: originalTestCase,
        passed: testPassed,
        actualOutput: actualOutput,
        stdout: detail.stdout,
        stderr: detail.stderr,
        compileOutput: detail.compile_output,
        status: statusDescription, // Use potentially overridden status
        judge0StatusId: statusId, // Use potentially overridden ID
        time: timeMs,
        memory: memoryKb,
        error: currentTestError, // Use potentially cleared error
      });
    }
  }
  
  // Final overall status
  if (totalTestCasesPassed !== originalTestCases.length && passedOverall && !compilationErrorDetail) {
      passedOverall = false; // If not all passed, overall is false
  }

  return {
    passed: passedOverall,
    testCasesPassed: totalTestCasesPassed,
    testCasesTotal: originalTestCases.length,
    executionTime: maxTimeMs, 
    memoryUsage: maxMemoryKb, 
    error: overallError,
    testResults: individualTestResults,
  };
} 