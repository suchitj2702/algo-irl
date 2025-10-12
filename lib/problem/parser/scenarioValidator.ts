/**
 * Scenario Validator - Validates parsed scenario structures
 *
 * This validator ensures that LLM-generated scenarios have been correctly parsed
 * and contain all required fields. It helps identify parsing failures early and
 * enables retry logic with targeted feedback.
 */

import { StructuredScenario } from '../types/transformationTypes';

/**
 * Validation result containing success status and detailed error messages
 */
export interface ValidationResult {
  /**
   * Whether the scenario passed all validation checks
   */
  isValid: boolean;

  /**
   * List of validation errors, empty if isValid is true
   */
  errors: string[];

  /**
   * List of warnings (non-critical issues)
   */
  warnings: string[];
}

/**
 * Validates a parsed StructuredScenario object to ensure all required fields
 * are present and properly formatted.
 *
 * Required fields:
 * - title: Non-empty string
 * - background: Non-empty string
 * - problemStatement: Non-empty string
 * - functionSignature: Non-empty string
 * - examples: At least one example with input and output
 *
 * Optional but recommended:
 * - constraints: Array (warns if empty)
 * - requirements: Array (warns if empty)
 * - functionMapping: Object (warns if empty)
 *
 * @param scenario - The parsed scenario to validate
 * @returns ValidationResult with isValid flag and error/warning messages
 */
export function validateStructuredScenario(scenario: StructuredScenario): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate title
  if (!scenario.title || scenario.title.trim().length === 0) {
    errors.push('Title is missing or empty');
  }

  // Validate background section
  if (!scenario.background || scenario.background.trim().length === 0) {
    errors.push('Background section is missing or empty');
  }

  // Validate problem statement
  if (!scenario.problemStatement || scenario.problemStatement.trim().length === 0) {
    errors.push('Problem statement is missing or empty');
  }

  // Validate function signature
  if (!scenario.functionSignature || scenario.functionSignature.trim().length === 0) {
    errors.push('Function signature is missing or empty');
  }

  // Validate examples
  if (!scenario.examples || scenario.examples.length === 0) {
    errors.push('No examples found - at least one example is required');
  } else {
    // Validate each example has input and output
    scenario.examples.forEach((example, index) => {
      if (!example.input || example.input.trim().length === 0) {
        errors.push(`Example ${index + 1} is missing input`);
      }
      if (!example.output || example.output.trim().length === 0) {
        errors.push(`Example ${index + 1} is missing output`);
      }
    });
  }

  // Warnings for optional but recommended fields
  if (!scenario.constraints || scenario.constraints.length === 0) {
    warnings.push('No constraints found - this is unusual for algorithm problems');
  }

  if (!scenario.requirements || scenario.requirements.length === 0) {
    warnings.push('No requirements found - technical requirements help clarify expectations');
  }

  if (!scenario.functionMapping || Object.keys(scenario.functionMapping).length === 0) {
    warnings.push('No function mapping found - original function names may not be transformed');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Creates a detailed error message from validation results.
 * Useful for logging and debugging parsing failures.
 *
 * @param validationResult - The validation result to format
 * @returns Formatted error message string
 */
export function formatValidationErrors(validationResult: ValidationResult): string {
  const parts: string[] = [];

  if (validationResult.errors.length > 0) {
    parts.push('Validation Errors:');
    validationResult.errors.forEach((error, i) => {
      parts.push(`  ${i + 1}. ${error}`);
    });
  }

  if (validationResult.warnings.length > 0) {
    parts.push('Validation Warnings:');
    validationResult.warnings.forEach((warning, i) => {
      parts.push(`  ${i + 1}. ${warning}`);
    });
  }

  return parts.join('\n');
}

/**
 * Creates an enhanced prompt feedback message to guide LLM retry attempts.
 * This helps the LLM understand what went wrong and how to fix it.
 *
 * @param validationResult - The validation result from the failed attempt
 * @param attemptNumber - Current attempt number (for context)
 * @returns Feedback message to prepend to retry prompt
 */
export function createRetryPromptFeedback(validationResult: ValidationResult, attemptNumber: number): string {
  const feedback: string[] = [
    `\n\n⚠️ RETRY ATTEMPT ${attemptNumber} - Previous response had formatting issues:\n`,
  ];

  if (validationResult.errors.length > 0) {
    feedback.push('Missing or empty required sections:');
    validationResult.errors.forEach((error) => {
      feedback.push(`  - ${error}`);
    });
    feedback.push('');
  }

  feedback.push('Please ensure your response includes ALL of these sections with proper markdown formatting:');
  feedback.push('  1. # Title (main heading)');
  feedback.push('  2. ## Problem Background (company context)');
  feedback.push('  3. ## The Problem (actual problem description)');
  feedback.push('  4. ## Function Signature (code template in markdown code block)');
  feedback.push('  5. ## Constraints (bulleted list)');
  feedback.push('  6. ## Examples (with Input:, Output:, and optionally Explanation:)');
  feedback.push('  7. ## Requirements (technical requirements as bulleted list)');
  feedback.push('  8. FUNCTION_MAPPING: section (format: originalName -> newName)');
  feedback.push('');
  feedback.push('Each section must have non-empty content. Do not skip any sections.\n');

  return feedback.join('\n');
}
