/**
 * Custom Error Types for Problem Transformation
 *
 * These error classes provide structured error information for different
 * types of failures in the problem transformation pipeline.
 */

import { ValidationResult } from '../parser/scenarioValidator';

/**
 * Error thrown when scenario parsing fails after all retry attempts.
 * This error includes detailed information about the validation failures
 * and the number of attempts made.
 */
export class ScenarioParsingError extends Error {
  /**
   * Number of parsing attempts made before failing
   */
  public readonly attempts: number;

  /**
   * Validation result from the final failed attempt
   */
  public readonly validationResult: ValidationResult;

  /**
   * Problem ID that was being transformed
   */
  public readonly problemId: string;

  /**
   * Company ID for the transformation context
   */
  public readonly companyId: string;

  /**
   * Raw scenario text from the final attempt (for debugging)
   */
  public readonly rawScenarioText?: string;

  constructor(
    message: string,
    problemId: string,
    companyId: string,
    attempts: number,
    validationResult: ValidationResult,
    rawScenarioText?: string
  ) {
    super(message);
    this.name = 'ScenarioParsingError';
    this.attempts = attempts;
    this.validationResult = validationResult;
    this.problemId = problemId;
    this.companyId = companyId;
    this.rawScenarioText = rawScenarioText;

    // Maintain proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScenarioParsingError);
    }
  }

  /**
   * Get a detailed error message including validation errors
   */
  getDetailedMessage(): string {
    const parts = [
      `Scenario parsing failed for problem ${this.problemId} and company ${this.companyId}`,
      `after ${this.attempts} attempt(s).`,
      '',
      'Validation Errors:',
    ];

    this.validationResult.errors.forEach((error, i) => {
      parts.push(`  ${i + 1}. ${error}`);
    });

    if (this.validationResult.warnings.length > 0) {
      parts.push('');
      parts.push('Validation Warnings:');
      this.validationResult.warnings.forEach((warning, i) => {
        parts.push(`  ${i + 1}. ${warning}`);
      });
    }

    if (this.rawScenarioText) {
      parts.push('');
      parts.push('Raw scenario text (first 500 chars):');
      parts.push(this.rawScenarioText.substring(0, 500));
    }

    return parts.join('\n');
  }
}

/**
 * Error thrown when transformation context cannot be created.
 * This typically happens when problem or company data is not found.
 */
export class TransformationContextError extends Error {
  public readonly problemId: string;
  public readonly companyId: string;

  constructor(message: string, problemId: string, companyId: string) {
    super(message);
    this.name = 'TransformationContextError';
    this.problemId = problemId;
    this.companyId = companyId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TransformationContextError);
    }
  }
}

/**
 * Error thrown when LLM service fails to generate a transformation.
 * This is different from parsing errors - the LLM service itself failed.
 */
export class LlmServiceError extends Error {
  public readonly problemId: string;
  public readonly companyId: string;
  public readonly attempt: number;
  public readonly underlyingError?: Error;

  constructor(
    message: string,
    problemId: string,
    companyId: string,
    attempt: number,
    underlyingError?: Error
  ) {
    super(message);
    this.name = 'LlmServiceError';
    this.problemId = problemId;
    this.companyId = companyId;
    this.attempt = attempt;
    this.underlyingError = underlyingError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LlmServiceError);
    }
  }
}
