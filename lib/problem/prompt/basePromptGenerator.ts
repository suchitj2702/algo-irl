/**
 * Base Prompt Generator - Creates the foundational transformation prompt
 *
 * This generator creates comprehensive prompts for transforming generic coding problems
 * into company-specific interview scenarios while preserving algorithmic essence.
 *
 * CRITICAL: No algorithm hints or approach suggestions are included in the prompts
 */

import { TransformationContext } from '../types/transformationTypes';

export class BasePromptGenerator {
  /**
   * Generate an optimized prompt for AI transformation of coding problems.
   * This function creates a comprehensive prompt that includes all necessary context
   * for transforming a generic coding problem into a company-specific interview scenario.
   *
   * Prompt Structure:
   * 1. Company context and background
   * 2. Original problem details and code template
   * 3. Technical analysis (algorithms, data structures, complexity)
   * 4. Company-specific analogies and suggestions
   * 5. Detailed transformation requirements and constraints
   * 6. Required output format specifications
   *
   * @param context - Complete transformation context with problem and company information
   * @returns Comprehensive prompt string for AI transformation
   */
  generateOptimizedPrompt(context: TransformationContext): string {
    const { problem, company, suggestedAnalogyPoints } = context;

    // Extract function names from defaultUserCode for mapping requirements
    const functionNamesToMap = this.extractFunctionNamesToMap(problem.defaultUserCode);

    // Format test cases - using sample test cases
    const testCasesStr = problem.testCases
      .map((tc) => `* Input: ${tc.input}\n* Output: ${tc.output}`)
      .join('\n');

    // Build the enhanced prompt with comprehensive transformation instructions
    const prompt = `
I need you to transform a coding problem into a company-specific interview scenario for ${company.name}. This should feel like a real technical interview question.

ORIGINAL PROBLEM:
"${problem.title}" (${problem.difficulty})
${problem.description}

${
  problem.defaultUserCode
    ? `
ORIGINAL CODE TEMPLATE:
\`\`\`python
${problem.defaultUserCode}
\`\`\`
`
    : ''
}

TECHNICAL ANALYSIS:
* Core Algorithms: ${problem.coreAlgorithms.join(', ') || 'N/A'}
* Data Structures: ${problem.dataStructures.join(', ') || 'N/A'}
* Time Complexity: ${problem.timeComplexity || 'Not specified, but maintain the original complexity'}
* Space Complexity: ${problem.spaceComplexity || 'Not specified, but maintain the original complexity'}

COMPANY CONTEXT:
* ${company.name} specializes in: ${company.domain}
* Key products: ${company.products.join(', ')}
* Technology stack: ${company.technologies.join(', ')}
* Interview focus areas: ${company.interviewFocus.join(', ')}

SUGGESTED COMPANY-SPECIFIC ANALOGIES:
${suggestedAnalogyPoints.map((point) => `* ${point}`).join('\n')}

${functionNamesToMap}

YOUR TASK:
Create a realistic interview scenario that a ${company.name} interviewer might present during a technical interview. The scenario MUST:

1. Maintain EXACTLY the same algorithmic approach and logical structure as the original
2. Preserve identical input/output data types (if input is an array of integers, keep it as an array of integers)
3. Include 2-3 clear examples with input→output test cases similar to the original problem. Use the test cases from the original problem ${testCasesStr}
4. Frame the problem within ${company.name}'s products, services, or technology domain
5. Keep the same time and space complexity requirements
6. Be concise, clear, and directly applicable to a technical interview setting
7. If applicable, mention any specific technical aspects of ${company.name} that relate to the problem

IMPORTANT REQUIREMENTS:
* The core problem MUST remain mathematically and logically equivalent to the original
* The problem should sound natural, not forced - like a real interview question
* Include any constraints from the original problem (e.g., size limits, value ranges)
* Name any variables or functions in ways that align with ${company.name}'s tech stack
* If the original has O(n) time complexity, maintain that exact requirement
* Make the scenario realistic - something a ${company.name} engineer might actually work on
* CRITICAL: Do NOT provide algorithm hints, approach suggestions, or implementation guidance anywhere in your response

REQUIRED FUNCTION/CLASS MAPPING:
At the very end of your response, please include a clear mapping section that lists all the functions, classes, and variables you've renamed. Format it like this:

FUNCTION_MAPPING:
original_function_name -> new_function_name
original_class_name -> new_class_name
original_variable_name -> new_variable_name

FORMAT YOUR RESPONSE WITH THESE EXACT SECTIONS:
1. "# [COMPANY_NAME] Technical Interview Question: [PROBLEM_TITLE]" - Use a descriptive, specific title
2. "## Problem Background" - Context setting within company domain
3. "## The Problem" - Clear, concise problem statement (what needs to be solved)
4. "## Function Signature" - Code block with the function/class signature and docstring. Do NOT include approach hints, algorithm suggestions, or implementation notes in docstrings
5. "## Constraints" - List all constraints as bullet points
6. "## Examples" - 2-3 examples with input, output, and explanation
7. "## Requirements" - Time/space complexity requirements ONLY. Do NOT mention specific algorithms, data structures, or recommended approaches

Format your response as a cohesive interview question, with an introduction, clear statement of the problem, and the function mapping section at the end.
DON'T CREATE MAPPING IF THE MAPPING IS UNCHANGED FOR SOME VALUE
`;

    return prompt;
  }

  /**
   * Extract function/class names from defaultUserCode for mapping requirements
   */
  protected extractFunctionNamesToMap(defaultUserCode?: string): string {
    if (!defaultUserCode) {
      return '';
    }

    // Look for function/class definitions in the code
    const funcMatches = defaultUserCode.match(/def\s+(\w+)\s*\(/g) || [];
    const classMatches = defaultUserCode.match(/class\s+(\w+)[:(]/g) || [];

    const functionNames = funcMatches.map((match) => match.replace(/def\s+/, '').replace(/\s*\($/, ''));
    const classNames = classMatches.map((match) => match.replace(/class\s+/, '').replace(/[:(]$/, ''));

    const allNames = [...functionNames, ...classNames].filter(Boolean);

    if (allNames.length > 0) {
      return `
SPECIFIC FUNCTIONS/CLASSES TO RENAME:
${allNames.join('\n')}

Make sure your mapping includes ALL of these names from the original code.
`;
    }

    return '';
  }
}