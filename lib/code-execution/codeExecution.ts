import { v4 as uuidv4 } from 'uuid';
import { Judge0Client, Judge0BatchSubmissionItem, Judge0SubmissionDetail } from './judge0Client';
import { getDriverDetails } from './languageConfigs';
import judge0Config from './judge0Config';

// Assuming TestCase is correctly imported from here.
// If not, the path might need adjustment based on your project structure.
import type { TestCase } from '../../data-types/problem'; 

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
  testCases: TestCase[];
}

export interface OrchestratedSubmissionOutput {
  internalSubmissionId: string;
  judge0Tokens: Array<{ token: string }>; 
}

/**
 * Orchestrates the submission of code to Judge0 as a batch.
 * Prepares each test case, sends to Judge0, and returns identifiers.
 */
export async function orchestrateJudge0Submission(
  client: Judge0Client,
  submissionInput: OrchestratedSubmissionInput
): Promise<OrchestratedSubmissionOutput> {
  const { code, language, testCases } = submissionInput;

  const internalSubmissionId = uuidv4();
  const driverDetails = getDriverDetails(language); // Throws if language not supported
  const langId = driverDetails.languageId;

  const batchItems: Judge0BatchSubmissionItem[] = testCases.map(testCase => {
    const finalSourceCode = driverDetails.driverTemplate.replace(
      driverDetails.userCodePlaceholder,
      code
    );
    const stdin = JSON.stringify(testCase.input);
    const expectedOutput = JSON.stringify(testCase.output);

    return {
      language_id: langId,
      source_code: finalSourceCode,
      stdin: stdin,
      expected_output: expectedOutput,
      // wall_time_limit, memory_limit could be added here if needed
    };
  });

  const callbackUrl = getJudge0CallbackUrl(internalSubmissionId);
  const judge0TokenResponses = await client.createBatchSubmissions(batchItems, callbackUrl);

  return {
    internalSubmissionId,
    judge0Tokens: judge0TokenResponses,
  };
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

      if (detail.status.id === 3) { // Accepted
        testPassed = true;
        totalTestCasesPassed++;
        try {
          actualOutput = detail.stdout ? JSON.parse(detail.stdout) : null;
        } catch (e) {
          testPassed = false; // Output was not valid JSON, consider it failed.
          currentTestError = "Output from code was not valid JSON.";
          if (e instanceof Error) currentTestError += ` Details: ${e.message}`;
          actualOutput = detail.stdout; // Store raw output
          if (!overallError) overallError = "One or more test cases had invalid JSON output.";
        }
      } else { // Any other status is a failure for this test case
        passedOverall = false;
        currentTestError = detail.message || detail.status.description;
        if (detail.stderr) currentTestError += ` (Stderr: ${detail.stderr})`;
        if (detail.compile_output) currentTestError += ` (Compile Output: ${detail.compile_output})`; // Should not happen if we check above
        if (!overallError && detail.status.id !== 4) { // Don't override with "Wrong Answer" if a more severe error exists
            overallError = currentTestError;
        }
         try { // Try to parse stdout even on error, might contain partial user debug prints
            actualOutput = detail.stdout ? JSON.parse(detail.stdout) : (detail.stdout || null);
        } catch {
            actualOutput = detail.stdout || null; // Store raw if not JSON
        }
      }

      individualTestResults.push({
        testCase: originalTestCase,
        passed: testPassed,
        actualOutput: actualOutput,
        stdout: detail.stdout,
        stderr: detail.stderr,
        compileOutput: detail.compile_output,
        status: detail.status.description,
        judge0StatusId: detail.status.id,
        time: timeMs,
        memory: memoryKb,
        error: currentTestError,
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