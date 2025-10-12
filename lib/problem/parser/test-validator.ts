/**
 * Simple test script for scenario validator
 * Run with: npx tsx lib/problem/parser/test-validator.ts
 */

import { ScenarioParser } from './scenarioParser';
import { formatValidationErrors } from './scenarioValidator';

console.log('='.repeat(80));
console.log('SCENARIO VALIDATOR TEST SUITE');
console.log('='.repeat(80));
console.log();

const parser = new ScenarioParser();

// Test 1: Valid scenario
console.log('Test 1: Valid Scenario (should pass)');
console.log('-'.repeat(80));
const validScenario = `
# Two Sum Problem - Amazon Interview

## Problem Background
You are working at Amazon on the recommendation engine team. The team needs to optimize product matching algorithms.

## The Problem
Given an array of integers representing product IDs and a target sum, find two product IDs that add up to the target.

## Function Signature
\`\`\`python
def find_product_pair(product_ids: List[int], target: int) -> List[int]:
    pass
\`\`\`

## Constraints
- Array length >= 2
- Valid solution always exists
- Cannot use same element twice

## Examples

**Example 1:**
Input: product_ids = [2,7,11,15], target = 9
Output: [0,1]
Explanation: product_ids[0] + product_ids[1] = 9

**Example 2:**
Input: product_ids = [3,2,4], target = 6
Output: [1,2]

## Requirements
- O(n) time complexity required
- Must use hash map approach
- Handle large input arrays efficiently

FUNCTION_MAPPING:
twoSum -> find_product_pair
`;

const result1 = parser.parseAndValidateScenario(validScenario);
console.log('✅ Validation Result:', result1.validation.isValid ? 'PASS' : 'FAIL');
console.log('Errors:', result1.validation.errors.length);
console.log('Warnings:', result1.validation.warnings.length);
if (result1.validation.warnings.length > 0) {
  console.log('Warning details:', result1.validation.warnings);
}
console.log();

// Test 2: Missing title
console.log('Test 2: Missing Title (should fail)');
console.log('-'.repeat(80));
const noTitleScenario = `
## Problem Background
Background text here...

## The Problem
Problem text here...

## Function Signature
\`\`\`python
def solution(): pass
\`\`\`

## Constraints
- Constraint 1

## Examples
Input: [1,2,3]
Output: [0,1]

## Requirements
- Requirement 1

FUNCTION_MAPPING:
solution -> solution
`;

const result2 = parser.parseAndValidateScenario(noTitleScenario);
console.log('✅ Validation Result:', result2.validation.isValid ? 'PASS' : 'FAIL');
console.log('Expected: FAIL');
console.log('Errors:');
console.log(formatValidationErrors(result2.validation));
console.log();

// Test 3: Missing function signature
console.log('Test 3: Missing Function Signature (should fail)');
console.log('-'.repeat(80));
const noSignatureScenario = `
# Problem Title

## Problem Background
Background text...

## The Problem
Problem description...

## Constraints
- Constraint 1

## Examples
Input: [1,2,3]
Output: [0,1]

## Requirements
- Requirement 1

FUNCTION_MAPPING:
solution -> solution
`;

const result3 = parser.parseAndValidateScenario(noSignatureScenario);
console.log('✅ Validation Result:', result3.validation.isValid ? 'PASS' : 'FAIL');
console.log('Expected: FAIL');
console.log('Errors:');
console.log(formatValidationErrors(result3.validation));
console.log();

// Test 4: Missing examples
console.log('Test 4: Missing Examples (should fail)');
console.log('-'.repeat(80));
const noExamplesScenario = `
# Problem Title

## Problem Background
Background text...

## The Problem
Problem description...

## Function Signature
\`\`\`python
def solution(): pass
\`\`\`

## Constraints
- Constraint 1

## Examples

## Requirements
- Requirement 1

FUNCTION_MAPPING:
solution -> solution
`;

const result4 = parser.parseAndValidateScenario(noExamplesScenario);
console.log('✅ Validation Result:', result4.validation.isValid ? 'PASS' : 'FAIL');
console.log('Expected: FAIL');
console.log('Errors:');
console.log(formatValidationErrors(result4.validation));
console.log();

// Test 5: Missing problem statement
console.log('Test 5: Missing Problem Statement (should fail)');
console.log('-'.repeat(80));
const noProblemScenario = `
# Problem Title

## Problem Background
Background text...

## Function Signature
\`\`\`python
def solution(): pass
\`\`\`

## Constraints
- Constraint 1

## Examples
Input: [1,2,3]
Output: [0,1]

## Requirements
- Requirement 1

FUNCTION_MAPPING:
solution -> solution
`;

const result5 = parser.parseAndValidateScenario(noProblemScenario);
console.log('✅ Validation Result:', result5.validation.isValid ? 'PASS' : 'FAIL');
console.log('Expected: FAIL');
console.log('Errors:');
console.log(formatValidationErrors(result5.validation));
console.log();

// Summary
console.log('='.repeat(80));
console.log('TEST SUMMARY');
console.log('='.repeat(80));
const results = [
  { name: 'Valid Scenario', expected: true, actual: result1.validation.isValid },
  { name: 'Missing Title', expected: false, actual: result2.validation.isValid },
  { name: 'Missing Function Signature', expected: false, actual: result3.validation.isValid },
  { name: 'Missing Examples', expected: false, actual: result4.validation.isValid },
  { name: 'Missing Problem Statement', expected: false, actual: result5.validation.isValid },
];

let passed = 0;
let failed = 0;

results.forEach((test) => {
  const status = test.expected === test.actual ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${test.name}`);
  if (test.expected === test.actual) {
    passed++;
  } else {
    failed++;
  }
});

console.log();
console.log(`Total: ${results.length} tests`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('='.repeat(80));

process.exit(failed > 0 ? 1 : 0);
