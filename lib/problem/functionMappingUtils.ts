/**
 * Function Mapping Utilities
 *
 * Utilities for applying function, class, and variable name mappings to code and test cases.
 * This module handles the transformation of generic coding problem templates into
 * company-specific scenarios by renaming identifiers.
 */

import { TestCase } from '@/data-types/problem';

/**
 * Apply function/class/variable name mappings to code.
 *
 * This function performs word-boundary-aware replacements to ensure that
 * only complete identifier names are replaced, not partial matches.
 *
 * Algorithm:
 * 1. Sort mappings by original name length (descending) to avoid partial replacements
 *    Example: Replace "fooBar" before "foo" to prevent incorrect transformations
 * 2. Escape special regex characters in original names
 * 3. Use word boundary regex (\b) to match complete identifiers only
 * 4. Apply replacements sequentially
 *
 * @param code - Source code string to transform
 * @param functionMapping - Object mapping original names to new names
 * @returns Transformed code with mappings applied
 *
 * @example
 * ```typescript
 * const code = "def twoSum(nums, target):\n    pass";
 * const mapping = { "twoSum": "findPairWithSum" };
 * const result = applyFunctionMappings(code, mapping);
 * // Returns: "def findPairWithSum(nums, target):\n    pass"
 * ```
 */
export function applyFunctionMappings(
  code: string,
  functionMapping: Record<string, string>
): string {
  let transformedCode = code;

  // Sort mappings by length in descending order to avoid partial replacements
  // (e.g., replacing "foo" before "fooBar" would cause issues)
  const sortedMappings = Object.entries(functionMapping)
    .sort((a, b) => b[0].length - a[0].length);

  // Replace each function/class name with its mapped version
  for (const [original, mapped] of sortedMappings) {
    // Escape special regex characters in the original name
    const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create a regex that matches the exact word boundaries
    const regex = new RegExp(`\\b${escapedOriginal}\\b`, 'g');
    transformedCode = transformedCode.replace(regex, mapped);
  }

  return transformedCode;
}

/**
 * Apply function mappings to test cases.
 *
 * This function transforms both input (stdin) and expected output (expectedStdout)
 * fields of test cases while preserving all other test case properties.
 *
 * Use Case: When a problem is transformed for a specific company, test case
 * data that references function or class names must also be updated.
 *
 * @param testCases - Array of test cases to transform
 * @param functionMapping - Object mapping original names to new names
 * @returns Array of transformed test cases
 *
 * @example
 * ```typescript
 * const testCases = [
 *   { stdin: "twoSum([2,7,11,15], 9)", expectedStdout: "[0,1]" }
 * ];
 * const mapping = { "twoSum": "findPairWithSum" };
 * const result = applyMappingsToTestCases(testCases, mapping);
 * // Returns: [{ stdin: "findPairWithSum([2,7,11,15], 9)", expectedStdout: "[0,1]" }]
 * ```
 */
export function applyMappingsToTestCases(
  testCases: TestCase[],
  functionMapping: Record<string, string>
): TestCase[] {
  return testCases.map(testCase => ({
    stdin: applyFunctionMappings(testCase.stdin, functionMapping),
    expectedStdout: applyFunctionMappings(testCase.expectedStdout, functionMapping),
    explanation: testCase.explanation,
    isSample: testCase.isSample,
    name: testCase.name,
    maxCpuTimeLimit: testCase.maxCpuTimeLimit,
    maxMemoryLimit: testCase.maxMemoryLimit,
  }));
}
