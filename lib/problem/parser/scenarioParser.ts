/**
 * Scenario Parser - Parses LLM-generated scenarios into structured sections
 *
 * This parser extracts and structures the different sections of a transformed
 * problem scenario, handling various formatting styles and edge cases.
 */

import { StructuredScenario } from '../types/transformationTypes';

export class ScenarioParser {
  /**
   * Parse AI-generated scenario text into structured sections.
   * This is the main parsing function that coordinates all section extraction
   * to create a complete StructuredScenario object.
   *
   * Process:
   * 1. Extract title from markdown heading
   * 2. Parse background section for company context
   * 3. Extract core problem statement
   * 4. Get function signature and code template
   * 5. Parse constraints into array format
   * 6. Extract and structure examples with input/output pairs
   * 7. Parse technical requirements
   * 8. Extract function name mappings
   *
   * @param scenarioText - Complete AI-generated scenario text
   * @returns Structured scenario object with all parsed sections
   */
  parseScenarioIntoSections(scenarioText: string): StructuredScenario {
    return {
      title: this.extractTitle(scenarioText),
      background: this.extractBackground(scenarioText),
      problemStatement: this.extractProblemStatement(scenarioText),
      functionSignature: this.extractFunctionSignature(scenarioText),
      constraints: this.extractConstraints(scenarioText),
      examples: this.extractExamples(scenarioText),
      requirements: this.extractRequirements(scenarioText),
      functionMapping: this.extractFunctionMapping(scenarioText),
    };
  }

  /**
   * Extract the title from the scenario text using regex pattern matching.
   * Looks for the main heading (# title) format in the AI-generated response.
   */
  private extractTitle(scenarioText: string): string {
    const titleMatch = scenarioText.match(/^#\s+(.+?)(?:\n|$)/m);
    return titleMatch ? titleMatch[1].trim() : '';
  }

  /**
   * Extract the problem background section from the scenario text.
   * This section provides company-specific context for the problem.
   */
  private extractBackground(scenarioText: string): string {
    const backgroundMatch = scenarioText.match(/## Problem Background\s*([\s\S]*?)(?=##|$)/);
    return backgroundMatch ? backgroundMatch[1].trim() : '';
  }

  /**
   * Extract the core problem statement from the scenario text.
   * This section contains the actual problem to be solved.
   */
  private extractProblemStatement(scenarioText: string): string {
    const problemMatch = scenarioText.match(/## The Problem\s*([\s\S]*?)(?=##|$)/);
    return problemMatch ? problemMatch[1].trim() : '';
  }

  /**
   * Extract the function signature section from the scenario text.
   * This includes the code template with function/class definitions.
   */
  private extractFunctionSignature(scenarioText: string): string {
    const signatureMatch = scenarioText.match(/## Function Signature\s*([\s\S]*?)(?=##|$)/);
    return signatureMatch ? signatureMatch[1].trim() : '';
  }

  /**
   * Extract and parse the constraints section into an array of individual constraints.
   * This function handles various bullet point formats and numbering styles.
   *
   * Algorithm:
   * 1. Find the constraints section using regex
   * 2. Split text by bullet points or numbered items
   * 3. Clean up formatting and remove empty items
   * 4. Return array of constraint strings
   */
  private extractConstraints(scenarioText: string): string[] {
    const constraintsMatch = scenarioText.match(/## Constraints\s*([\s\S]*?)(?=##|$)/);
    if (!constraintsMatch) return [];

    const constraintsText = constraintsMatch[1].trim();
    // Split by bullet points or numbered items
    const items = constraintsText
      .split(/\n\s*[-*•]\s*|\n\s*\d+\.\s*/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    // Clean any remaining bullet points from the beginning of each item
    return items.map((item) => item.replace(/^[-*•]\s*/, '').trim());
  }

  /**
   * Extract and parse examples into structured objects with input/output pairs.
   * This function handles multiple example formats and attempts to extract explanations.
   *
   * Algorithm:
   * 1. Find examples section in text
   * 2. Try multiple parsing strategies:
   *    - Example blocks with "Example X:" headers
   *    - Bullet-formatted input/output pairs
   *    - Code blocks representing examples
   *    - Simple Input:/Output: patterns
   * 3. Return structured array with input, output, and optional explanations
   */
  private extractExamples(scenarioText: string): Array<{ input: string; output: string; explanation?: string }> {
    const examplesMatch = scenarioText.match(/## Examples\s*([\s\S]*?)(?=##|$)/);
    if (!examplesMatch) return [];

    const examplesText = examplesMatch[1].trim();

    // Strategy 1: Look for "Example X:" patterns
    const exampleBlocks = examplesText
      .split(/\s*(?:\*\*)?Example \d+(?:\*\*)?:?\s*/i)
      .map((block) => block.trim())
      .filter((block) => block.length > 0);

    if (exampleBlocks.length > 0) {
      return exampleBlocks.map((block) => {
        // Handle bullet-formatted examples
        if (/^\s*[-*•]\s*Input:/im.test(block)) {
          const inputMatch = block.match(/\s*[-*•]\s*Input:?\s*([^\n]*(?:\n(?![-*•]\s*(?:Output|Explanation))[^\n]*)*)/i);
          const outputMatch = block.match(/\s*[-*•]\s*Output:?\s*([^\n]*(?:\n(?![-*•]\s*(?:Input|Explanation))[^\n]*)*)/i);
          const explanationMatch = block.match(/\s*[-*•]\s*Explanation:?\s*([^\n]*(?:\n(?![-*•]\s*(?:Input|Output))[^\n]*)*)/i);

          return {
            input: inputMatch ? inputMatch[1].trim() : '',
            output: outputMatch ? outputMatch[1].trim() : '',
            explanation: explanationMatch ? explanationMatch[1].trim() : undefined,
          };
        }

        // Standard format
        const inputMatch = block.match(/Input:?\s*([^\n]*(?:\n(?!Output:|Explanation:)[^\n]*)*)/i);
        const outputMatch = block.match(/Output:?\s*([^\n]*(?:\n(?!Input:|Explanation:)[^\n]*)*)/i);
        const explanationMatch = block.match(/Explanation:?\s*([^\n]*(?:\n(?!Input:|Output:)[^\n]*)*)/i);

        return {
          input: inputMatch ? inputMatch[1].trim() : '',
          output: outputMatch ? outputMatch[1].trim() : '',
          explanation: explanationMatch ? explanationMatch[1].trim() : undefined,
        };
      });
    }

    // Strategy 2: Find examples by looking for code blocks
    const codeBlocks = examplesText.match(/```[^`]*```/g);
    if (codeBlocks && codeBlocks.length >= 2) {
      const examples = [];
      for (let i = 0; i < codeBlocks.length - 1; i += 2) {
        examples.push({
          input: codeBlocks[i].replace(/```(?:python|javascript|java)?\n?|\n?```/g, '').trim(),
          output: codeBlocks[i + 1].replace(/```(?:python|javascript|java)?\n?|\n?```/g, '').trim(),
        });
      }
      return examples;
    }

    // Strategy 3: Simple Input/Output pattern matching
    const inputMatches = Array.from(examplesText.matchAll(/Input:?\s*([^\n]*(?:\n(?!Output:|Explanation:|Example \d+:)[^\n]*)*)/gi));
    const outputMatches = Array.from(examplesText.matchAll(/Output:?\s*([^\n]*(?:\n(?!Input:|Explanation:|Example \d+:)[^\n]*)*)/gi));
    const explanationMatches = Array.from(examplesText.matchAll(/Explanation:?\s*([^\n]*(?:\n(?!Input:|Output:|Example \d+:)[^\n]*)*)/gi));

    const inputs = inputMatches.map((m) => m[1].trim());
    const outputs = outputMatches.map((m) => m[1].trim());
    const explanations = explanationMatches.map((m) => m[1].trim());

    const examples = [];
    for (let i = 0; i < Math.min(inputs.length, outputs.length); i++) {
      examples.push({
        input: inputs[i],
        output: outputs[i],
        explanation: i < explanations.length ? explanations[i] : undefined,
      });
    }

    return examples;
  }

  /**
   * Extract and parse the requirements section into an array of requirement strings.
   * This function handles various formatting styles for technical requirements.
   */
  private extractRequirements(scenarioText: string): string[] {
    const requirementsMatch = scenarioText.match(/## Requirements\s*([\s\S]*?)(?=FUNCTION_MAPPING:|$)/);
    if (!requirementsMatch) return [];

    const requirementsText = requirementsMatch[1].trim();
    // Split by bullet points or numbered items
    const items = requirementsText
      .split(/\n\s*[-*•]\s*|\n\s*\d+\.\s*/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    // Clean any remaining bullet points from the beginning of each item
    return items.map((item) => item.replace(/^[-*•]\s*/, '').trim());
  }

  /**
   * Extract function mapping from the scenario text.
   * This function parses the AI-generated mapping of original function names
   * to company-specific function names.
   *
   * Algorithm:
   * 1. Find FUNCTION_MAPPING section in text
   * 2. Parse mapping lines in format "original -> new"
   * 3. Handle various arrow formats and whitespace
   * 4. Return object with original names as keys, new names as values
   */
  private extractFunctionMapping(scenarioText: string): Record<string, string> {
    const functionMapping: Record<string, string> = {};
    const mappingRegex = /FUNCTION_MAPPING:\s*([\s\S]+?)(?:\n\n|$)/;
    const mappingMatch = scenarioText.match(mappingRegex);

    if (mappingMatch && mappingMatch[1]) {
      const mappingLines = mappingMatch[1].trim().split('\n');
      mappingLines.forEach((line) => {
        const [original, renamed] = line.split('->').map((part) => part.trim());
        if (original && renamed) {
          functionMapping[original] = renamed;
        }
      });
    }

    return functionMapping;
  }
}