import { v4 as uuidv4 } from 'uuid';
import { Judge0Client, Judge0BatchSubmissionItem, Judge0SubmissionDetail } from './judge0Client';
import judge0Config from './judge0Config';

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
  testCases: TestCase[]; // Optional when problemId is provided
  boilerplateCode: string; // Added boilerplateCode
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
 * Orchestrates the submission of code to Judge0 as a batch.
 * Now supports both direct test cases and loading from problems.
 */
export async function orchestrateJudge0Submission(
  client: Judge0Client,
  submissionInput: OrchestratedSubmissionInput
): Promise<OrchestratedSubmissionOutput> {
  const { code, language, testCases, boilerplateCode } = submissionInput;
  let finalCode = code;
  let finalTestCases: TestCase[] = testCases; // Use testCases directly
  let maxCpuTimeLimit: number | undefined;
  let maxMemoryLimit: number | undefined;
  let expectedOutput: string | null = null;
  
  // Combine user code with boilerplate
  finalCode = combineUserCodeWithBoilerplate(
    code, 
    boilerplateCode, // Use provided boilerplateCode
    language
  );
    
  if (!finalTestCases || finalTestCases.length === 0) {
    throw new Error('TestCases must be provided');
  }

  const internalSubmissionId = uuidv4();
  const langId = getLanguageId(language); // Get language ID for Judge0

  const batchItems: Judge0BatchSubmissionItem[] = finalTestCases.map(testCase => {
    // Prepare input based on test case format
    const stdin = testCase.stdin;
    expectedOutput = testCase.expectedStdout;
    
    if (expectedOutput == "None") {
      expectedOutput = "null";
    }
    
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
 * Checks if the expected output string is an array of possible outputs
 * and compares the actual output against each of them.
 */
function checkMultipleExpectedOutputs(actual: string | null | undefined, expected: string | null | undefined): boolean {
  const normalizedActual = actual?.trim() ?? "";
  const normalizedExpectedString = expected?.trim() ?? "";

  if (!normalizedExpectedString.startsWith('[') || !normalizedExpectedString.endsWith(']')) {
    // Not a stringified array, so let the standard comparison handle it
    return false;
  }

  // Try to parse the actual output if it looks like a JSON string
  let parsedActual = normalizedActual;
  try {
    if (normalizedActual.startsWith('"') && normalizedActual.endsWith('"')) {
      parsedActual = JSON.parse(normalizedActual);
    }
  } catch (e) {
    // If parsing fails, use the original normalizedActual
    parsedActual = normalizedActual;
  }

  try {
    const expectedOutputsArray = JSON.parse(normalizedExpectedString);
    if (!Array.isArray(expectedOutputsArray)) {
      return false; // Parsed but not an array
    }

    for (const singleExpected of expectedOutputsArray) {
      // Convert singleExpected to string if it's not already, as normalizeAndCompareOutputs expects strings
      const singleExpectedStr = typeof singleExpected === 'string' ? singleExpected : JSON.stringify(singleExpected);
      if (normalizeAndCompareOutputs(parsedActual, singleExpectedStr)) {
        return true; // Found a match
      }
    }
    return false; // No match in the array
  } catch (e) {
    // JSON parsing failed, or it wasn't an array of strings/parsable objects
    return false;
  }
}

/**
 * Compares two string arrays, ignoring the order of elements.
 * Returns true if they contain the same elements, false otherwise.
 */
function compareUnorderedStringArrays(actual: string | null | undefined, expected: string | null | undefined): boolean {
  const actualStr = actual?.trim() ?? "";
  const expectedStr = expected?.trim() ?? "";

  // Ensure both are string representations of arrays
  if (!actualStr.startsWith('[') || !actualStr.endsWith(']') || 
      !expectedStr.startsWith('[') || !expectedStr.endsWith(']')) {
    return false;
  }

  try {
    const actualArray = JSON.parse(actualStr);
    const expectedArray = JSON.parse(expectedStr);

    if (!Array.isArray(actualArray) || !Array.isArray(expectedArray)) {
      return false; // Not arrays
    }

    if (actualArray.length !== expectedArray.length) {
      return false; // Different number of elements
    }

    if (actualArray.length === 0) {
      return true; // Both are empty arrays, considered equal
    }

    // Convert elements to strings, sort, and compare
    // This handles arrays of simple types like strings or numbers
    const sortedActual = actualArray.map(String).sort();
    const sortedExpected = expectedArray.map(String).sort();

    // Compare sorted arrays element by element
    for (let i = 0; i < sortedActual.length; i++) {
      if (sortedActual[i] !== sortedExpected[i]) {
        return false;
      }
    }

    return true; // All elements match

  } catch (e) {
    return false; // JSON parsing failed or other error
  }
}

/**
 * Compares two arrays of arrays, where the order of elements in both the outer and inner arrays does not matter.
 * Returns true if they contain the same inner arrays (with elements in any order), false otherwise.
 */
function compareUnorderedArraysOfArrays(actual: string | null | undefined, expected: string | null | undefined): boolean {
  const actualStr = actual?.trim() ?? "";
  const expectedStr = expected?.trim() ?? "";

  // Ensure both are string representations of arrays (outer arrays)
  if (!actualStr.startsWith('[') || !actualStr.endsWith(']') || 
      !expectedStr.startsWith('[') || !expectedStr.endsWith(']')) {
    return false;
  }

  try {
    const actualOuterArray = JSON.parse(actualStr);
    const expectedOuterArray = JSON.parse(expectedStr);

    if (!Array.isArray(actualOuterArray) || !Array.isArray(expectedOuterArray)) {
      return false; // Not arrays
    }

    if (actualOuterArray.length !== expectedOuterArray.length) {
      return false; // Different number of inner arrays
    }

    if (actualOuterArray.length === 0) {
      return true; // Both are empty outer arrays, considered equal
    }

    const getCanonicalInnerArrayString = (innerArray: any): string | null => {
      if (!Array.isArray(innerArray)) {
        return null; // Element of outer array is not an array
      }
      // Sort elements within the inner array. Handles numbers and other primitives consistently.
      const sortedInnerArray = [...innerArray].sort((a, b) => {
        if (typeof a === 'number' && typeof b === 'number') {
          return a - b;
        }
        return String(a).localeCompare(String(b));
      });
      return JSON.stringify(sortedInnerArray);
    };

    const canonicalActualStrings = actualOuterArray.map(getCanonicalInnerArrayString);
    const canonicalExpectedStrings = expectedOuterArray.map(getCanonicalInnerArrayString);

    // If any inner element was not an array, its canonical string will be null.
    if (canonicalActualStrings.some(s => s === null) || canonicalExpectedStrings.some(s => s === null)) {
        return false; // Structure mismatch (expected array of arrays)
    }

    // Filter out nulls just in case, though the above check should catch it.
    const filteredActualStrings = canonicalActualStrings.filter(s => s !== null) as string[];
    const filteredExpectedStrings = canonicalExpectedStrings.filter(s => s !== null) as string[];
    
    if (filteredActualStrings.length !== actualOuterArray.length || filteredExpectedStrings.length !== expectedOuterArray.length) {
        // This implies some elements were not arrays if lengths changed after filtering nulls from non-null map results.
        return false;
    }

    filteredActualStrings.sort();
    filteredExpectedStrings.sort();

    for (let i = 0; i < filteredActualStrings.length; i++) {
      if (filteredActualStrings[i] !== filteredExpectedStrings[i]) {
        return false;
      }
    }

    return true; // All canonical inner arrays match

  } catch (e) {
    return false; // JSON parsing failed or other error
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
        const multipleExpectedMatch = checkMultipleExpectedOutputs(detail.stdout, originalTestCase.expectedStdout);
        const normalizedMatch = normalizeAndCompareOutputs(detail.stdout, originalTestCase.expectedStdout);
        const unorderedArrayMatch = compareUnorderedStringArrays(detail.stdout, originalTestCase.expectedStdout);
        const unorderedArraysOfArraysMatch = compareUnorderedArraysOfArrays(detail.stdout, originalTestCase.expectedStdout);

        if (multipleExpectedMatch || normalizedMatch || unorderedArrayMatch || unorderedArraysOfArraysMatch) { // Outputs match after normalization, one of multiple expected outputs, unordered array match, or unordered array of arrays match!
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