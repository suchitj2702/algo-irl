/**
 * Shared utilities for batch problem generation scripts
 */

import * as fs from 'fs';
import * as path from 'path';
import { BatchMetadata } from './types';

/**
 * Base directory for batch problem generation
 */
export const BASE_DIR = path.join(__dirname);
export const INPUT_DIR = path.join(BASE_DIR, 'input');
export const OUTPUT_DIR = path.join(BASE_DIR, 'output');
export const BATCH_PROMPTS_DIR = path.join(OUTPUT_DIR, 'batch-prompts');
export const BATCH_JOBS_DIR = path.join(OUTPUT_DIR, 'batch-jobs');
export const BATCH_RESULTS_DIR = path.join(OUTPUT_DIR, 'batch-results');

/**
 * Ensure all required directories exist
 */
export function ensureDirectories(): void {
  [INPUT_DIR, OUTPUT_DIR, BATCH_PROMPTS_DIR, BATCH_JOBS_DIR, BATCH_RESULTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Read problem URLs from input file
 */
export function readProblemUrls(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#')); // Filter empty lines and comments
}

/**
 * Save batch metadata to JSON file
 */
export function saveBatchMetadata(metadata: BatchMetadata): void {
  const filePath = path.join(BATCH_JOBS_DIR, `${metadata.batch_name}_metadata.json`);
  fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2), 'utf-8');
}

/**
 * Load batch metadata from JSON file
 */
export function loadBatchMetadata(batchName: string): BatchMetadata | null {
  const filePath = path.join(BATCH_JOBS_DIR, `${batchName}_metadata.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as BatchMetadata;
}

/**
 * Get all batch metadata files
 */
export function getAllBatchMetadata(): BatchMetadata[] {
  if (!fs.existsSync(BATCH_JOBS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(BATCH_JOBS_DIR)
    .filter(file => file.endsWith('_metadata.json'));

  return files.map(file => {
    const content = fs.readFileSync(path.join(BATCH_JOBS_DIR, file), 'utf-8');
    return JSON.parse(content) as BatchMetadata;
  });
}

/**
 * Discover all batch prompt files that haven't been submitted yet
 */
export function discoverUnsubmittedBatchFiles(): string[] {
  if (!fs.existsSync(BATCH_PROMPTS_DIR)) {
    return [];
  }

  const promptFiles = fs.readdirSync(BATCH_PROMPTS_DIR)
    .filter(file => file.endsWith('.jsonl'))
    .map(file => path.join(BATCH_PROMPTS_DIR, file));

  // Check which ones don't have metadata yet
  const existingMetadata = getAllBatchMetadata();
  const submittedFiles = new Set(existingMetadata.map(m => m.prompt_file));

  return promptFiles.filter(file => !submittedFiles.has(file));
}

/**
 * Generate batch name from index
 */
export function generateBatchName(index: number): string {
  return `batch_${String(index).padStart(3, '0')}`;
}

/**
 * Get next available batch index
 */
export function getNextBatchIndex(): number {
  if (!fs.existsSync(BATCH_PROMPTS_DIR)) {
    return 1;
  }

  const files = fs.readdirSync(BATCH_PROMPTS_DIR)
    .filter(file => file.startsWith('batch_') && file.endsWith('.jsonl'));

  if (files.length === 0) {
    return 1;
  }

  const indices = files.map(file => {
    const match = file.match(/batch_(\d+)\.jsonl/);
    return match ? parseInt(match[1], 10) : 0;
  });

  return Math.max(...indices) + 1;
}

/**
 * Format timestamp for logging
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Log with timestamp
 */
export function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '✓',
    warn: '⚠',
    error: '✗'
  }[level];

  console.log(`[${timestamp}] ${prefix} ${message}`);
}

/**
 * Count lines in JSONL file
 */
export function countJsonlLines(filePath: string): number {
  if (!fs.existsSync(filePath)) {
    return 0;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').filter(line => line.trim()).length;
}

/**
 * Extract problem slug from LeetCode URL or return slug if already a slug
 * Supports both formats:
 * - Full URL: "https://leetcode.com/problems/two-sum/" -> "two-sum"
 * - Slug only: "two-sum" -> "two-sum"
 */
export function extractSlugFromUrl(input: string): string | null {
  const trimmedInput = input.trim().replace(/\/$/, ''); // Remove trailing slash

  // First, check if input is already a slug (no protocol, no slashes)
  // Slug format: lowercase letters, numbers, and hyphens only
  if (!trimmedInput.includes('://') && !trimmedInput.includes('/')) {
    if (/^[a-z0-9-]+$/.test(trimmedInput)) {
      return trimmedInput;
    }
    // Invalid slug format
    return null;
  }

  // Try to parse as URL
  try {
    const parsedUrl = new URL(input);
    if (parsedUrl.hostname !== 'leetcode.com') {
      return null;
    }
    const pathParts = parsedUrl.pathname.split('/').filter(part => part !== '');
    if (pathParts.length >= 2 && pathParts[0] === 'problems') {
      return pathParts[1];
    }
    return null;
  } catch {
    // URL parsing failed and it's not a valid slug
    return null;
  }
}

/**
 * System prompt for problem generation (copied from llmUtils to avoid initialization issues)
 */
export const PROBLEM_GENERATION_SYSTEM_PROMPT = `You are a specialized data generator for algorithm problems.
You know the details of common LeetCode problems.
When given a problem name/slug, generate realistic, detailed problem data.
IMPORTANT: You MUST include comprehensive solution approaches for every problem, providing multiple approaches when applicable.
Your solution approaches should be detailed, including code examples and explanations of how the solutions work. ` +
`Every field requested in the prompt MUST be included in your response. Make the problem description detailed ` +
`and the test cases realistic.`;

/**
 * Generate problem data generation prompt (copied from llmUtils to avoid initialization issues)
 */
export function getProblemDataGenerationPrompt(problemName: string, problemSlug: string): string {
  const pythonVersionString = '3.8';
  return `Generate structured data for the LeetCode problem "${problemName}" (slug: "${problemSlug}").

Based on your knowledge of this common algorithmic problem, provide the following in a valid JSON format only:
{
  "title": "(string) The full title of the problem.",
  "difficulty": "(string) Easy, Medium, or Hard.",
  "categories": ["(string) Array", "(string) Hash Table"],
  "description": "(string) A detailed problem description. This MUST clearly state the expected function signature or class structure ` +
    `(e.g., for Python using \`typing.List\`): \`from typing import List; def twoSum(nums: List[int], target: int) -> List[int]:\`). ` +
    `Include any helper class definitions (like TreeNode) standard for the problem. If providing code examples within the description, ` +
    `ensure they are formatted as valid JSON strings (e.g., newlines as \\\\n, quotes as \\\\\\", etc.).",
  "constraints": ["(string) 2 <= nums.length <= 10^4", "(string) -10^9 <= nums[i] <= 10^9"],
  "testCases": [
    {
      "stdin": "(string) A JSON string representing the input. Example: {\\\\\\\"nums\\\\\\\": [2, 7, 11, 15], \\\\\\\"target\\\\\\\": 9}",
      "expectedStdout": "(string) A JSON string representing the array of expected output. Example: [0, 1]. If there are multiple correct values for a test case, the expectedStdout should be an array of the correct values.",
      "isSample": true
    }
  ],
  "solutionApproach": "(string) Detailed explanation of efficient solution approaches. Must not be null or empty. No need to include code.",
  "timeComplexity": "(string) Big O time complexity of optimal solution (e.g., O(n)). Must not be null or empty.",
  "spaceComplexity": "(string) Big O space complexity of optimal solution (e.g., O(1) or O(n)). Must not be null or empty.",
  "languageSpecificDetails": {
    "python": {
      "solutionFunctionNameOrClassName": "(string) e.g., twoSum or Solution",
      "solutionStructureHint": "(string) Python (${pythonVersionString}): Example for Python 3.8 compatibility - \`from typing import List; ` +
        `def twoSum(nums: List[int], target: int) -> List[int]:\` or \`from typing import List; class Solution:\\\\n    ` +
        `def twoSum(self, nums: List[int], target: int) -> List[int]:\`",
      "defaultUserCode": "(string) The MINIMAL skeleton code for the user, compatible with ${pythonVersionString}. ` +
        `For type hints, use the 'typing' module. E.g., \`from typing import List; def twoSum(nums: List[int], target: int) -> List[int]:\\\\n    pass\` ` +
        `or \`from typing import List; class Solution:\\\\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\\\\n        pass\`. ` +
        `NO helper classes or solution logic here.",
      "boilerplateCodeWithPlaceholder": "(string) COMPLETE runnable Python script for Judge0, compatible with ${pythonVersionString}. ` +
        `It MUST include imports like \`from typing import List, Dict, Optional\` if type hints such as \`List[int]\` are used. ` +
        `Also include other standard imports (json, sys), helper classes (e.g., TreeNode if relevant for the problem), ` +
        `the placeholder \`%%USER_CODE_PYTHON%%\`, robust stdin/stdout JSON handling, and error handling. Example for Two Sum using \`typing.List\`: ` +
        `import json; import sys; from typing import List; %%USER_CODE_PYTHON%% if __name__ == '__main__': try: input_str = sys.stdin.read(); ` +
        `data = json.loads(input_str); nums_arg = data['nums']; target_arg = data['target']; ` +
        `# Ensure function (e.g. twoSum) is defined by user code; result = twoSum(nums_arg, target_arg); print(json.dumps(result)); ` +
        `except Exception as e: print(f'Execution Error: {str(e)}', file=sys.stderr); sys.exit(1)\\"",
      "optimizedSolutionCode": "(string) The COMPLETE and correct solution code for the function/class specified in solutionFunctionNameOrClassName, ` +
        `compatible with ${pythonVersionString}. This code should be ready to be inserted into the boilerplate placeholder and pass all test cases."
    }
  }
}

IMPORTANT INSTRUCTIONS FOR AI:
1.  The entire response MUST be a single, valid JSON object. Do not include any text, explanations, or markdown formatting like \`\`\`json ` +
    `before or after the JSON object.
2.  Every field specified in the structure above MUST be included.
3.  For the 'testCases' field: Generate 15 diverse test cases. It MUST be a valid JSON array of objects. Each object must be ` +
    `a complete JSON object, and array elements correctly comma-separated. NO TRAILING COMMAS. 'stdin' and 'expectedStdout' fields must be ` +
    `valid JSON STRINGS, meaning special characters (like quotes, newlines) within these strings must be properly escaped ` +
    `(e.g., use \\\\\\\\\\\" for a quote inside the string). Example of a test case object: {\\\"stdin\\\": \\\"{\\\\\\\\\\\"root\\\\\\\\\\\\\": [1,2,3,null,null,4,5]}\\\", ` +
    `\\\"expectedStdout\\\": \\\"[[1],[2,3],[4,5]]\\\", \\\"isSample\\\": true}.
4. CRITICAL: The 'testCases' you generate MUST be correct. Verify that the 'expectedStdout' for each test case is the actual output ` +
    `produced when the corresponding 'stdin' is processed by the 'optimizedSolutionCode' you provide for the primary language (Python). ` +
    `Incorrect test cases are unacceptable.
5. For each test case generated, perform a dry run of the 'optimizedSolutionCode' with the 'stdin' to ensure it is correct. IF IT IS NOT CORRECT, REMOVE IT;`  +
`6. If there are multiple correct values for a test case, the expectedStdout should be an array of the correct values.`;
}
