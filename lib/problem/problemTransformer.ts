/**
 * Problem Transformer - Main orchestrator for problem transformation pipeline
 *
 * This is a slim orchestration layer that coordinates all transformation modules.
 * All business logic has been moved to specialized modules for maintainability.
 *
 * Architecture:
 * - Extraction: problemExtractor, companyExtractor
 * - Analysis: roleAnalyzer
 * - Generation: analogyGenerator, rolePromptGenerator
 * - Parsing: scenarioParser
 * - Caching: transformCacheUtils
 */

import { RoleFamily } from '@/data-types/role';
import { getCompanyById, getAllCompanies } from '../company/companyUtils';
import { getProblemById } from './problemDatastoreUtils';
import { transformWithPrompt } from '../llmServices/llmUtils';
import { getTransformation, saveTransformation } from './transformCacheUtils';
import { ProblemExtractor } from './extraction/problemExtractor';
import { CompanyExtractor } from './extraction/companyExtractor';
import { RoleAnalyzer } from './role/roleAnalyzer';
import { AnalogyGenerator } from './analogy/analogyGenerator';
import { RolePromptGenerator } from './prompt/rolePromptGenerator';
import { ScenarioParser } from './parser/scenarioParser';
import { TransformationContext, StructuredScenario } from './types/transformationTypes';

/**
 * Main Problem Transformer class - coordinates all transformation modules
 */
class ProblemTransformerOrchestrator {
  private problemExtractor: ProblemExtractor;
  private companyExtractor: CompanyExtractor;
  private roleAnalyzer: RoleAnalyzer;
  private analogyGenerator: AnalogyGenerator;
  private promptGenerator: RolePromptGenerator;
  private scenarioParser: ScenarioParser;

  constructor() {
    // Initialize all specialized modules
    this.problemExtractor = new ProblemExtractor();
    this.companyExtractor = new CompanyExtractor();
    this.roleAnalyzer = new RoleAnalyzer();
    this.analogyGenerator = new AnalogyGenerator();
    this.promptGenerator = new RolePromptGenerator(this.roleAnalyzer);
    this.scenarioParser = new ScenarioParser();
  }

  /**
   * Create transformation context for a problem and company with optional role.
   * This orchestrates the extraction and context creation process.
   *
   * @param problemId - Unique identifier for the problem
   * @param companyId - Unique identifier for the company
   * @param roleFamily - Optional role for role-specific context
   * @returns Complete transformation context or null if data not found
   */
  async createTransformationContext(
    problemId: string,
    companyId: string,
    roleFamily?: RoleFamily
  ): Promise<TransformationContext | null> {
    try {
      // Fetch problem and company data
      const problem = await getProblemById(problemId);
      const company = await getCompanyById(companyId);

      if (!problem || !company) {
        console.error(`Problem or company not found: ${problemId}, ${companyId}`);
        return null;
      }

      // Extract key information using specialized extractors
      const problemInfo = this.problemExtractor.extractProblemInfo(problem);
      const companyInfo = this.companyExtractor.extractCompanyInfo(company, problemInfo.keywords);

      // Calculate relevance score
      const relevanceScore = this.companyExtractor.calculateRelevanceScore(problemInfo, companyInfo);

      // Generate suggested analogy points with role context
      const suggestedAnalogyPoints = this.analogyGenerator.generateSuggestedAnalogyPoints(
        problemInfo,
        companyInfo,
        roleFamily
      );

      return {
        problem: problemInfo,
        company: companyInfo,
        relevanceScore,
        suggestedAnalogyPoints,
      };
    } catch (error) {
      console.error('Error creating transformation context:', error);
      return null;
    }
  }

  /**
   * Find the most relevant company for a specific problem.
   * This function evaluates all companies to find the best match.
   *
   * @param problemId - Unique identifier for the problem
   * @returns Company ID of the most relevant company, or null if none found
   */
  async findMostRelevantCompany(problemId: string): Promise<string | null> {
    try {
      // Get the problem data
      const problem = await getProblemById(problemId);
      if (!problem) {
        console.error(`Problem not found: ${problemId}`);
        return null;
      }

      // Extract problem info
      const problemInfo = this.problemExtractor.extractProblemInfo(problem);

      // Get all companies
      const companies = await getAllCompanies();

      let maxScore = -1;
      let mostRelevantCompanyId: string | null = null;

      // Calculate relevance for each company
      for (const company of companies) {
        const companyInfo = this.companyExtractor.extractCompanyInfo(company, problemInfo.keywords);
        const score = this.companyExtractor.calculateRelevanceScore(problemInfo, companyInfo);

        if (score > maxScore) {
          maxScore = score;
          mostRelevantCompanyId = company.id || null;
        }
      }

      return mostRelevantCompanyId;
    } catch (error) {
      console.error('Error finding most relevant company:', error);
      return null;
    }
  }

  /**
   * Main transformation function - orchestrates the entire pipeline.
   * This is the primary entry point for transforming problems.
   *
   * Workflow:
   * 1. Check cache for existing transformation
   * 2. Create transformation context with all extracted data
   * 3. Generate optimized prompt (with role enhancement if specified)
   * 4. Call LLM service to transform the problem
   * 5. Parse LLM response into structured sections
   * 6. Save to cache for future use
   * 7. Return complete result
   *
   * @param problemId - Unique identifier for the problem to transform
   * @param companyId - Unique identifier for the target company
   * @param roleFamily - Optional role for role-specific transformation
   * @param useCache - Whether to use cached transformations (default: true)
   * @returns Complete transformation result with structured scenario and context
   * @throws Error if transformation fails or required data is missing
   */
  async transformProblem(
    problemId: string,
    companyId: string,
    roleFamily?: RoleFamily,
    useCache: boolean = true
  ): Promise<{
    structuredScenario: StructuredScenario;
    contextInfo: {
      detectedAlgorithms: string[];
      detectedDataStructures: string[];
      relevanceScore: number;
      suggestedAnalogyPoints: string[];
    };
  }> {
    try {
      // Step 1: Check cache if enabled
      if (useCache) {
        const cachedTransformation = await getTransformation(problemId, companyId, roleFamily);

        if (cachedTransformation) {
          console.log(
            `Using cached transformation for problem ${problemId}, company ${companyId}${roleFamily ? `, role ${roleFamily}` : ''}`
          );

          // Parse the cached scenario into structured sections
          const structuredScenario = this.scenarioParser.parseScenarioIntoSections(cachedTransformation.scenario);

          return {
            structuredScenario,
            contextInfo: cachedTransformation.contextInfo,
          };
        }
      }

      // Step 2: No cache - create transformation context
      const context = await this.createTransformationContext(problemId, companyId, roleFamily);

      if (!context) {
        throw new Error('Failed to create transformation context');
      }

      // Step 3: Generate optimized prompt (with role enhancement if specified)
      const optimizedPrompt = this.promptGenerator.generateOptimizedPromptWithRole(context, roleFamily);

      // Step 4: Call LLM service
      const transformationSystemPrompt = `You are an expert technical interviewer who specializes in creating algorithm and data structure problems for software engineering interviews.
Your task is to transform coding problems into realistic company-specific interview scenarios while preserving their algorithmic essence.
Your scenarios should feel like actual questions a candidate would receive in a technical interview, with appropriate domain-specific framing that aligns with the company's business and technology.`;

      // DEBUG: Print the complete prompt being sent to the LLM
      console.log('\n' + '='.repeat(80));
      console.log('🤖 PROBLEM TRANSFORMATION PROMPT - DEBUG OUTPUT');
      console.log('='.repeat(80));
      console.log(`Problem ID: ${problemId}`);
      console.log(`Company ID: ${companyId}`);
      console.log(`Role: ${roleFamily || 'None (standard transformation)'}`);
      console.log('='.repeat(80));
      console.log('SYSTEM PROMPT:');
      console.log('-'.repeat(80));
      console.log(transformationSystemPrompt);
      console.log('-'.repeat(80));
      console.log('\nUSER PROMPT:');
      console.log('-'.repeat(80));
      console.log(optimizedPrompt);
      console.log('-'.repeat(80));
      console.log('='.repeat(80) + '\n');

      // Create cache key for this transformation
      const cacheKey = `transform-prompt-${problemId}-${companyId}${roleFamily ? `-${roleFamily}` : ''}`
        .toLowerCase()
        .replace(/\s+/g, '-');

      // Use the LLM utility to get transformation
      const scenarioText = await transformWithPrompt(
        optimizedPrompt,
        transformationSystemPrompt,
        cacheKey,
        useCache
      );

      // Step 5: Parse the scenario text into structured sections
      const structuredScenario = this.scenarioParser.parseScenarioIntoSections(scenarioText);

      // Prepare result
      const result = {
        structuredScenario,
        contextInfo: {
          detectedAlgorithms: context.problem.coreAlgorithms,
          detectedDataStructures: context.problem.dataStructures,
          relevanceScore: context.relevanceScore,
          suggestedAnalogyPoints: context.suggestedAnalogyPoints,
        },
      };

      // Step 6: Save to cache for future use
      try {
        await saveTransformation(
          {
            problemId,
            companyId,
            scenario: scenarioText,
            functionMapping: structuredScenario.functionMapping,
            contextInfo: result.contextInfo,
          },
          roleFamily
        );
        console.log(`Saved transformation for problem ${problemId}, company ${companyId}${roleFamily ? `, role ${roleFamily}` : ''}`);
      } catch (error) {
        // Log error but don't fail the transformation
        console.error('Error saving transformation to cache:', error);
      }

      return result;
    } catch (error) {
      console.error('Error transforming problem:', error);
      throw new Error(`Failed to transform problem: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Create singleton instance
const transformer = new ProblemTransformerOrchestrator();

/**
 * Transform a problem into a company-specific scenario.
 * This is the main entry point for the transformation API.
 *
 * @param problemId - Unique identifier for the problem to transform
 * @param companyId - Unique identifier for the target company
 * @param roleFamily - Optional role for role-specific transformation
 * @param useCache - Whether to use cached transformations (default: true)
 * @returns Complete transformation result
 */
export async function transformProblem(
  problemId: string,
  companyId: string,
  roleFamily?: RoleFamily,
  useCache: boolean = true
) {
  return transformer.transformProblem(problemId, companyId, roleFamily, useCache);
}

/**
 * Create transformation context for a problem and company.
 * Useful for previewing context without performing full transformation.
 *
 * @param problemId - Unique identifier for the problem
 * @param companyId - Unique identifier for the company
 * @param roleFamily - Optional role for role-specific context
 * @returns Transformation context or null if data not found
 */
export async function createTransformationContext(
  problemId: string,
  companyId: string,
  roleFamily?: RoleFamily
) {
  return transformer.createTransformationContext(problemId, companyId, roleFamily);
}

/**
 * Find the most relevant company for a specific problem.
 *
 * @param problemId - Unique identifier for the problem
 * @returns Company ID of the most relevant company, or null if none found
 */
export async function findMostRelevantCompany(problemId: string) {
  return transformer.findMostRelevantCompany(problemId);
}

/**
 * Parse a scenario text into structured sections.
 * Useful for testing or re-parsing existing scenarios.
 *
 * @param scenarioText - Complete scenario text to parse
 * @returns Structured scenario object
 */
export function parseScenarioIntoSections(scenarioText: string): StructuredScenario {
  const parser = new ScenarioParser();
  return parser.parseScenarioIntoSections(scenarioText);
}

// Export types for external use
export type { TransformationContext, StructuredScenario } from './types/transformationTypes';
export type { RoleFamily } from '@/data-types/role';

// Default export for backward compatibility
const problemTransformerUtils = {
  transformProblem,
  createTransformationContext,
  findMostRelevantCompany,
  parseScenarioIntoSections,
};

export default problemTransformerUtils;
