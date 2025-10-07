/**
 * Problem Extractor - Unified logic for extracting technical concepts from problems
 * Uses the TechnicalConceptRegistry for consistent pattern-based matching
 */

import { Problem } from '@/data-types/problem';
import { ExtractedProblemInfo } from '../types/transformationTypes';
import { TechnicalConceptRegistry } from './technicalConceptRegistry';

export class ProblemExtractor {
  /**
   * Unified method to extract technical concepts from problems using pattern-based matching.
   * This ensures all extractions use the same pattern engine for consistency.
   *
   * @param problem - Problem object to analyze
   * @param extractionType - Type of extraction: 'keywords', 'algorithms', or 'data_structures'
   * @returns Array of extracted concept names
   */
  private extractTechnicalConcepts(
    problem: Problem,
    extractionType: 'keywords' | 'algorithms' | 'data_structures'
  ): string[] {
    // Prepare text for analysis - combine all relevant fields
    const categories = problem.categories || [];
    let combinedText = `${problem.title} ${problem.description} ${categories.join(' ')}`;

    // Add solution approach if available (helps with better detection)
    if (problem.solutionApproach) {
      combinedText += ` ${problem.solutionApproach}`;
    }

    // Convert to lowercase for case-insensitive matching
    const text = combinedText.toLowerCase();
    const results: string[] = [];

    if (extractionType === 'keywords') {
      // Use pattern-based extraction for consistency - unified approach
      results.push(...TechnicalConceptRegistry.extractFromText(text, TechnicalConceptRegistry.ALGORITHM_PATTERNS));
      results.push(...TechnicalConceptRegistry.extractFromText(text, TechnicalConceptRegistry.STRUCTURE_PATTERNS));

      // Check common terms
      for (const term of TechnicalConceptRegistry.COMMON_TERMS) {
        if (text.includes(term.toLowerCase())) {
          results.push(term);
        }
      }

      // Add categories directly
      results.push(...categories);

      // Check complexity patterns
      for (const { pattern, type } of TechnicalConceptRegistry.COMPLEXITY_PATTERNS) {
        if (pattern.test(text)) {
          results.push(type);
        }
      }

      // Remove duplicates
      return [...new Set(results)];
    } else if (extractionType === 'algorithms') {
      // Extract from main text
      results.push(...TechnicalConceptRegistry.extractFromText(text, TechnicalConceptRegistry.ALGORITHM_PATTERNS));

      // Check categories with same patterns
      for (const category of problem.categories) {
        results.push(
          ...TechnicalConceptRegistry.extractFromText(category.toLowerCase(), TechnicalConceptRegistry.ALGORITHM_PATTERNS)
        );
      }

      // Remove duplicates while preserving order
      return Array.from(new Set(results));
    } else if (extractionType === 'data_structures') {
      // Extract from main text
      results.push(...TechnicalConceptRegistry.extractFromText(text, TechnicalConceptRegistry.STRUCTURE_PATTERNS));

      // Check categories with same patterns
      for (const category of problem.categories) {
        results.push(
          ...TechnicalConceptRegistry.extractFromText(category.toLowerCase(), TechnicalConceptRegistry.STRUCTURE_PATTERNS)
        );
      }

      // Remove duplicates while preserving order
      return Array.from(new Set(results));
    }

    return results;
  }

  /**
   * Extract keywords from problem description.
   * Keywords include algorithms, data structures, common terms, and complexity indicators.
   *
   * @param problem - The problem object to analyze
   * @returns Array of extracted keywords
   */
  extractProblemKeywords(problem: Problem): string[] {
    return this.extractTechnicalConcepts(problem, 'keywords');
  }

  /**
   * Detect core algorithms used in the problem using pattern matching.
   * This function uses regex patterns to identify algorithmic approaches
   * required to solve the problem.
   *
   * @param problem - The problem object to analyze
   * @returns Array of detected algorithm names
   */
  detectCoreAlgorithms(problem: Problem): string[] {
    return this.extractTechnicalConcepts(problem, 'algorithms');
  }

  /**
   * Detect data structures used in the problem using pattern matching.
   * This function identifies the primary data structures needed to solve the problem.
   *
   * @param problem - The problem object to analyze
   * @returns Array of detected data structure names
   */
  detectDataStructures(problem: Problem): string[] {
    return this.extractTechnicalConcepts(problem, 'data_structures');
  }

  /**
   * Extract comprehensive information from a problem for transformation.
   * This function consolidates all relevant problem data into a structured format
   * optimized for AI-based problem transformation.
   *
   * @param problem - The complete problem object from database
   * @returns Structured problem information for transformation
   */
  extractProblemInfo(problem: Problem): ExtractedProblemInfo {
    const keywords = this.extractProblemKeywords(problem);
    const coreAlgorithms = this.detectCoreAlgorithms(problem);
    const dataStructures = this.detectDataStructures(problem);

    // Extract Python specific defaultUserCode if available
    const defaultUserCode = problem.languageSpecificDetails?.python?.defaultUserCode;

    // Extract sample test cases for transformation examples
    const testCases = problem.testCases
      .filter((testCase) => testCase.isSample)
      .map((testCase) => ({
        input: testCase.stdin,
        output: testCase.expectedStdout,
      }));

    return {
      title: problem.title,
      difficulty: problem.difficulty,
      description: problem.description,
      constraints: problem.constraints,
      categories: problem.categories,
      timeComplexity: problem.timeComplexity || null,
      spaceComplexity: problem.spaceComplexity || null,
      keywords,
      coreAlgorithms,
      dataStructures,
      defaultUserCode,
      testCases,
    };
  }
}