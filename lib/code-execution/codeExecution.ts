import { v4 as uuidv4 } from 'uuid';
import { Judge0Client, Judge0BatchSubmissionItem, Judge0SubmissionDetail } from './judge0Client';
import judge0Config from './judge0Config';
import { compareOutputs } from './outputComparison';

import type { TestCase } from '../../data-types/problem';
import type { ExecutionResults, TestCaseOutput } from '../../data-types/execution';

export interface TestResult {
  testCase: TestCase; // Original testCase input
  passed: boolean;
  actualOutput: TestCaseOutput; // Parsed actual output (e.g., from JSON stdout)
  stdout?: string | null; // Raw stdout from Judge0
  stderr?: string | null; // Raw stderr from Judge0
  compileOutput?: string | null; // Compile output from Judge0
  status: string; // Judge0 status description (e.g., "Accepted", "Wrong Answer")
  judge0StatusId: number; // Judge0 status ID (e.g., 3 for Accepted)
  time: number; // Execution time in milliseconds
  memory: number; // Memory usage in kilobytes
  error?: string | null; // Aggregated error message for this test case
}

/**
 * Constructs the callback URL for Judge0 submissions with the internal submission ID.
 * This URL is used by Judge0 to notify our system when execution is complete.
 * 
 * @param internalSubmissionId - UUID generated internally to track this submission
 * @returns The full callback URL with submission ID parameter, or undefined if not in production
 */
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
  testCases: TestCase[]; // Test cases to execute against
  boilerplateCode: string; // Template code with placeholder for user code
}

export interface OrchestratedSubmissionOutput {
  internalSubmissionId: string;
  judge0Tokens: Array<{ token: string }>; 
}

/**
 * Combines user-written code with problem-specific boilerplate code.
 * This function replaces language-specific placeholders in the boilerplate
 * with the actual user code, creating executable code for Judge0.
 * 
 * Algorithm:
 * 1. Define language-specific placeholders (e.g., %%USER_CODE_PYTHON%%)
 * 2. Locate the appropriate placeholder for the given language
 * 3. Replace the placeholder with trimmed user code to prevent injection
 * 
 * @param userCode - The raw code written by the user
 * @param boilerplate - Template code containing language-specific placeholder
 * @param language - Programming language identifier (python, javascript, etc.)
 * @returns Complete executable code ready for Judge0 submission
 */
export function combineUserCodeWithBoilerplate(userCode: string, boilerplate: string, language: string): string {
  // Define language-specific placeholders
  const placeholders: Record<string, string> = {
    'python': '%%USER_CODE_PYTHON%%',
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
 * Orchestrates the complete code execution workflow with Judge0.
 * This is the main entry point for code execution, handling:
 * - Code combination with boilerplate
 * - Batch submission creation
 * - Callback URL generation for async processing
 * 
 * Algorithm:
 * 1. Combine user code with boilerplate template
 * 2. Validate test cases are provided
 * 3. Generate unique internal submission ID for tracking
 * 4. Create Judge0 batch submission items for each test case
 * 5. Apply resource limits (CPU time, memory) if specified
 * 6. Submit batch to Judge0 with optional callback URL
 * 
 * @param client - Configured Judge0Client instance for API communication
 * @param submissionInput - Complete submission data including code, language, and test cases
 * @returns Promise resolving to submission tracking information
 * @throws Error if test cases are missing or language is unsupported
 */
export async function orchestrateJudge0Submission(
  client: Judge0Client,
  submissionInput: OrchestratedSubmissionInput
): Promise<OrchestratedSubmissionOutput> {
  const { code, language, testCases, boilerplateCode } = submissionInput;
  let finalCode = code;
  const finalTestCases: TestCase[] = testCases;
  let maxCpuTimeLimit: number | undefined;
  let maxMemoryLimit: number | undefined;
  let expectedOutput: string | null = null;
  
  // Combine user code with boilerplate
  finalCode = combineUserCodeWithBoilerplate(
    code, 
    boilerplateCode,
    language
  );
    
  if (!finalTestCases || finalTestCases.length === 0) {
    throw new Error('TestCases must be provided');
  }

  const internalSubmissionId = uuidv4();
  const langId = getLanguageId(language); // Get language ID for Judge0

  // Create batch submission items - one for each test case
  const batchItems: Judge0BatchSubmissionItem[] = finalTestCases.map(testCase => {
    // Prepare input based on test case format
    const stdin = testCase.stdin;
    expectedOutput = testCase.expectedStdout;
    
    // Normalize "None" output to "null" for consistent JSON handling
    if (expectedOutput == "None") {
      expectedOutput = "null";
    }
    
    const item: Judge0BatchSubmissionItem = {
      language_id: langId,
      source_code: finalCode,
      stdin: stdin,
      expected_output: expectedOutput,
    };
    
    // Apply global resource limits if provided
    if (maxCpuTimeLimit) {
      item.cpu_time_limit = maxCpuTimeLimit;
    }
    if (maxMemoryLimit) {
      item.memory_limit = maxMemoryLimit;
    }
    
    // Override with test case specific limits if available
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
 * Retrieves the Judge0 language ID for a given language string.
 * Maps our internal language identifiers to Judge0's numeric language IDs.
 * 
 * @param language - Internal language identifier (e.g., "python", "javascript")
 * @returns Judge0 numeric language ID
 * @throws Error if language is not supported or not configured
 */
export function getLanguageId(language: string): number {
  const langConfig = judge0Config.languages[language as keyof typeof judge0Config.languages];
  if (!langConfig || typeof langConfig.id === 'undefined') {
    throw new Error(`Unsupported language or ID not configured in judge0Config: ${language}`);
  }
  return langConfig.id;
}

/**
 * Aggregates results from multiple Judge0 submission details into a single execution result.
 * This is the core algorithm for processing batch execution results.
 * 
 * Algorithm:
 * 1. Check for compilation errors (affects all test cases)
 * 2. For each test case:
 *    - Parse execution results and resource usage
 *    - Apply intelligent output comparison strategies
 *    - Override Judge0 status if our comparison logic finds a match
 * 3. Aggregate timing and memory usage (takes maximum values)
 * 4. Determine overall pass/fail status
 * 5. Compile detailed results for each test case
 * 
 * @param judge0Details - Array of Judge0 execution results, one per test case
 * @param originalTestCases - Original test case definitions with expected outputs
 * @returns Aggregated execution results with overall status and detailed test results
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
    // Priority: compile_output > stderr > message (compile_output usually has the most detail)
    overallError = compilationErrorDetail.compile_output || compilationErrorDetail.stderr || compilationErrorDetail.message || "Compilation failed";

    // Log full compilation error for debugging
    console.error('Compilation error detected:', {
      compile_output: compilationErrorDetail.compile_output,
      stderr: compilationErrorDetail.stderr,
      message: compilationErrorDetail.message,
    });

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

      // Convert Judge0 time (seconds) to milliseconds and extract memory usage
      const timeMs = detail.time ? parseFloat(detail.time) * 1000 : 0;
      const memoryKb = detail.memory || 0;

      // Track maximum resource usage across all test cases
      if (timeMs > maxTimeMs) maxTimeMs = timeMs;
      if (memoryKb > maxMemoryKb) maxMemoryKb = memoryKb;

      let testPassed = false;
      let actualOutput: unknown = null;
      let currentTestError: string | null = null;
      let statusDescription = detail.status.description; // Start with original status
      let statusId = detail.status.id; // Start with original status ID

      // Helper to parse stdout output into appropriate data type
      const parseStdout = (stdout: string | null | undefined): TestCaseOutput => {
        if (!stdout) return null;
        const trimmedStdout = stdout.trim();
        if (trimmedStdout.startsWith('{') || trimmedStdout.startsWith('[')) {
          try {
            return JSON.parse(trimmedStdout) as TestCaseOutput;
          } catch {
            // Fallback to raw string if JSON parsing fails
            return stdout;
          }
        }
        return stdout; // Return raw string for non-JSON output
      };

      if (detail.status.id === 3) { // Status 3: Accepted by Judge0
        testPassed = true;
        totalTestCasesPassed++;
        actualOutput = parseStdout(detail.stdout);
      } else { 
        // Judge0 says not accepted, but apply our intelligent comparison algorithms
        if (compareOutputs(detail.stdout, originalTestCase.expectedStdout)) {
          // Outputs match after applying intelligent comparison strategies
          testPassed = true;
          totalTestCasesPassed++;
          statusDescription = "Accepted"; // Override Judge0 status
          statusId = 3; // Override Judge0 status ID
          currentTestError = null; // Clear any error message
          actualOutput = parseStdout(detail.stdout);
        } else {
          // Outputs still don't match after all comparison strategies
          passedOverall = false; // Mark overall submission as failed

          // Build comprehensive error message with priority: stderr > message > status.description
          // stderr often contains the most detailed error information (stack traces, etc.)
          if (detail.stderr) {
            currentTestError = detail.stderr;
            // Log full error details for debugging
            console.error(`Test case ${i} failed with stderr:`, detail.stderr);
          } else if (detail.message) {
            currentTestError = detail.message;
            console.error(`Test case ${i} failed with message:`, detail.message);
          } else {
            currentTestError = detail.status.description;
          }

          // Log additional context if available
          if (detail.stdout && detail.stderr) {
            console.log(`Test case ${i} stdout:`, detail.stdout);
          }

          // Keep original statusDescription and statusId from Judge0
          if (!overallError && detail.status.id !== 4) { // Don't override with "Wrong Answer" if a more severe error exists
              overallError = currentTestError;
          }
          actualOutput = parseStdout(detail.stdout); // Parse the output even if failed
        }
      }

      individualTestResults.push({
        testCase: originalTestCase,
        passed: testPassed,
        actualOutput: actualOutput as TestCaseOutput,
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
  
  // Final overall status determination
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