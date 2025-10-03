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

import { RoleFamily, getRandomRole } from '@/data-types/role';
import { Problem, TestCase } from '@/data-types/problem';
import type { Company } from '@/data-types/company';
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
import { applyFunctionMappings, applyMappingsToTestCases } from './functionMappingUtils';

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
   * Create transformation context for a problem and company with specified role.
   * This orchestrates the extraction and context creation process.
   *
   * @param problemId - Unique identifier for the problem
   * @param companyId - Unique identifier for the company
   * @param roleFamily - Role for role-specific context (required for optimal transformations)
   * @param prefetchedProblem - Optional pre-fetched problem data to avoid redundant DB reads
   * @param prefetchedCompany - Optional pre-fetched company data to avoid redundant DB reads
   * @returns Complete transformation context or null if data not found
   */
  async createTransformationContext(
    problemId: string,
    companyId: string,
    roleFamily: RoleFamily,
    prefetchedProblem?: Problem | null,
    prefetchedCompany?: Company | null
  ): Promise<TransformationContext | null> {
    try {
      // Use prefetched data if available, otherwise fetch (latency optimization)
      let problem = prefetchedProblem;
      let company = prefetchedCompany;

      if (!problem || !company) {
        // Fetch missing data in parallel
        const [fetchedProblem, fetchedCompany] = await Promise.all([
          problem ? Promise.resolve(problem) : getProblemById(problemId),
          company ? Promise.resolve(company) : getCompanyById(companyId)
        ]);
        problem = fetchedProblem;
        company = fetchedCompany;
      }

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
   * Role Handling:
   * - If role is provided, uses it for transformation
   * - If role is NOT provided, auto-selects a random role for diversity
   * - Auto-selection ensures every transformation gets role-enhanced prompts
   *
   * Workflow:
   * 1. Auto-select role if not provided
   * 2. Check cache for existing transformation
   * 3. Create transformation context with all extracted data
   * 4. Generate role-enhanced prompt
   * 5. Call LLM service to transform the problem
   * 6. Parse LLM response into structured sections
   * 7. Save to cache for future use
   * 8. Return complete result with role metadata
   *
   * @param problemId - Unique identifier for the problem to transform
   * @param companyId - Unique identifier for the target company
   * @param roleFamily - Optional role for role-specific transformation (auto-selected if not provided)
   * @param useCache - Whether to use cached transformations (default: true)
   * @param prefetchedProblem - Optional pre-fetched problem data to avoid redundant DB reads
   * @param prefetchedCompany - Optional pre-fetched company data to avoid redundant DB reads
   * @returns Complete transformation result with structured scenario, context, and role info
   * @throws Error if transformation fails or required data is missing
   */
  async transformProblem(
    problemId: string,
    companyId: string,
    roleFamily?: RoleFamily,
    useCache: boolean = true,
    prefetchedProblem?: Problem | null,
    prefetchedCompany?: Company | null
  ): Promise<{
    structuredScenario: StructuredScenario;
    contextInfo: {
      detectedAlgorithms: string[];
      detectedDataStructures: string[];
      relevanceScore: number;
      suggestedAnalogyPoints: string[];
    };
    roleFamily: RoleFamily;
    wasRoleAutoSelected: boolean;
  }> {
    try {
      // Step 1: Determine role - use provided or auto-select for diversity
      let selectedRole: RoleFamily;
      let wasRoleAutoSelected = false;

      if (roleFamily) {
        selectedRole = roleFamily;
      } else {
        selectedRole = getRandomRole();
        wasRoleAutoSelected = true;
        console.log(`Auto-selected role for transformation: ${selectedRole} (problem: ${problemId}, company: ${companyId})`);
      }
      // Step 2: Check cache if enabled (using selected role)
      if (useCache) {
        const cachedTransformation = await getTransformation(problemId, companyId, selectedRole);

        if (cachedTransformation) {
          console.log(
            `Using cached transformation for problem ${problemId}, company ${companyId}, role ${selectedRole}`
          );

          // Parse the cached scenario into structured sections
          const structuredScenario = this.scenarioParser.parseScenarioIntoSections(cachedTransformation.scenario);

          return {
            structuredScenario,
            contextInfo: cachedTransformation.contextInfo,
            roleFamily: selectedRole,
            wasRoleAutoSelected,
          };
        }
      }

      // Step 3: No cache - create transformation context with pre-fetched data if available
      const context = await this.createTransformationContext(
        problemId,
        companyId,
        selectedRole,
        prefetchedProblem,
        prefetchedCompany
      );

      if (!context) {
        throw new Error('Failed to create transformation context');
      }

      // Step 4: Generate role-enhanced prompt (role is always provided here)
      const optimizedPrompt = this.promptGenerator.generateOptimizedPromptWithRole(context, selectedRole);

      // Step 5: Call LLM service
      const transformationSystemPrompt = `You are an expert technical interviewer who specializes in creating algorithm and data structure problems for software engineering interviews.
Your task is to transform coding problems into realistic company-specific interview scenarios while preserving their algorithmic essence.
Your scenarios should feel like actual questions a candidate would receive in a technical interview, with appropriate domain-specific framing that aligns with the company's business and technology.`;

      // DEBUG: Print the complete prompt being sent to the LLM
      console.log('\n' + '='.repeat(80));
      console.log('🤖 PROBLEM TRANSFORMATION PROMPT - DEBUG OUTPUT');
      console.log('='.repeat(80));
      console.log(`Problem ID: ${problemId}`);
      console.log(`Company ID: ${companyId}`);
      console.log(`Role: ${selectedRole}${wasRoleAutoSelected ? ' (auto-selected)' : ' (user-provided)'}`);
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

      // Create cache key for this transformation (using selected role)
      const cacheKey = `transform-prompt-${problemId}-${companyId}-${selectedRole}`
        .toLowerCase()
        .replace(/\s+/g, '-');

      // Use the LLM utility to get transformation
      const scenarioText = await transformWithPrompt(
        optimizedPrompt,
        transformationSystemPrompt,
        cacheKey,
        useCache
      );

      // Step 6: Parse the scenario text into structured sections
      const structuredScenario = this.scenarioParser.parseScenarioIntoSections(scenarioText);

      // Prepare result with role metadata
      const result = {
        structuredScenario,
        contextInfo: {
          detectedAlgorithms: context.problem.coreAlgorithms,
          detectedDataStructures: context.problem.dataStructures,
          relevanceScore: context.relevanceScore,
          suggestedAnalogyPoints: context.suggestedAnalogyPoints,
        },
        roleFamily: selectedRole,
        wasRoleAutoSelected,
      };

      // Step 7: Save to cache asynchronously (non-blocking for user response)
      // Fire-and-forget: cache write happens in background without blocking user
      saveTransformation(
        {
          problemId,
          companyId,
          scenario: scenarioText,
          functionMapping: structuredScenario.functionMapping,
          contextInfo: result.contextInfo,
        },
        selectedRole
      )
        .then(() => {
          console.log(`Saved transformation for problem ${problemId}, company ${companyId}, role ${selectedRole}${wasRoleAutoSelected ? ' (auto-selected)' : ''}`);
        })
        .catch((error) => {
          // Log error but don't fail the transformation
          console.error('Error saving transformation to cache:', error);
        });

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
 * Role Handling (CENTRALIZED):
 * - If role is provided: Uses specified role for transformation
 * - If role is NOT provided: Auto-selects a random role for diversity
 * - All transformations get role-enhanced prompts
 *
 * The role influences:
 * - Problem framing and context
 * - Technology stack and terminology used
 * - Real-world scenarios and examples
 * - Algorithmic emphasis and focus areas
 *
 * @param problemId - Unique identifier for the problem to transform
 * @param companyId - Unique identifier for the target company
 * @param roleFamily - Optional role for role-specific transformation (auto-selected if not provided)
 * @param useCache - Whether to use cached transformations (default: true)
 * @param prefetchedProblem - Optional pre-fetched problem data to avoid redundant DB reads
 * @param prefetchedCompany - Optional pre-fetched company data to avoid redundant DB reads
 * @returns Complete transformation result with role-enhanced content and role metadata
 */
export async function transformProblem(
  problemId: string,
  companyId: string,
  roleFamily?: RoleFamily,
  useCache: boolean = true,
  prefetchedProblem?: Problem | null,
  prefetchedCompany?: Company | null
) {
  return transformer.transformProblem(problemId, companyId, roleFamily, useCache, prefetchedProblem, prefetchedCompany);
}

/**
 * Transform and prepare a complete problem with all mappings applied.
 * This is a higher-level function that combines transformation with problem fetching
 * and function mapping application. Use this when you need a fully prepared problem
 * ready for presentation to the user.
 *
 * Role Handling:
 * - If role is provided: Uses specified role
 * - If role is NOT provided: Delegates to transformProblem which auto-selects
 * - All transformations get role-enhanced prompts
 *
 * Workflow:
 * 1. Fetch original problem data from database
 * 2. Get or generate role-enhanced transformation (auto-selected if not provided)
 * 3. Extract language-specific code details
 * 4. Apply function/class name mappings to all code and test cases
 * 5. Return fully prepared problem with transformed content and role metadata
 *
 * @param problemId - Unique identifier for the problem to transform
 * @param companyId - Unique identifier for the target company
 * @param roleFamily - Optional role for role-specific transformation (auto-selected if not provided)
 * @param useCache - Whether to use cached transformations (default: true)
 * @returns Fully prepared problem with applied mappings, role-enhanced content, and metadata
 * @throws Error if problem not found, transformation fails, or language details missing
 *
 * @example
 * ```typescript
 * // With explicit role
 * const prepared = await transformAndPrepareProblem('two-sum', 'google', RoleFamily.BACKEND_SYSTEMS);
 * // With auto-selected role
 * const prepared = await transformAndPrepareProblem('two-sum', 'google');
 * console.log(prepared.roleFamily); // Shows which role was used
 * console.log(prepared.wasRoleAutoSelected); // true if auto-selected
 * ```
 */
export async function transformAndPrepareProblem(
  problemId: string,
  companyId: string,
  roleFamily?: RoleFamily,
  useCache: boolean = true
): Promise<{
  transformedProblem: {
    structuredScenario: StructuredScenario;
    contextInfo: {
      detectedAlgorithms: string[];
      detectedDataStructures: string[];
      relevanceScore: number;
      suggestedAnalogyPoints: string[];
    };
  };
  problemData: Problem;
  appliedMappings: {
    defaultUserCode: string;
    boilerplateCode: string;
    testCases: TestCase[];
    functionName: string;
    solutionStructureHint: string;
  };
  roleFamily: RoleFamily;
  wasRoleAutoSelected: boolean;
}> {
  // Step 1: Fetch problem and company data in parallel (latency optimization)
  const [problem, company] = await Promise.all([
    getProblemById(problemId),
    getCompanyById(companyId)
  ]);

  if (!problem) {
    throw new Error(`Problem not found: ${problemId}`);
  }
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  // Step 2: Get or generate transformation, passing pre-fetched data to avoid redundant DB reads
  const transformResult = await transformProblem(problemId, companyId, roleFamily, useCache, problem, company);

  // Step 3: Extract Python-specific code details
  // TODO: Make this language-agnostic by accepting language parameter
  const pythonDetails = problem.languageSpecificDetails?.python;
  if (!pythonDetails) {
    throw new Error(`Python implementation details not available for problem: ${problemId}`);
  }

  // Step 4: Apply function/class name mappings to all code elements
  const mappings = transformResult.structuredScenario.functionMapping;

  return {
    transformedProblem: {
      structuredScenario: transformResult.structuredScenario,
      contextInfo: transformResult.contextInfo,
    },
    problemData: problem,
    appliedMappings: {
      defaultUserCode: applyFunctionMappings(pythonDetails.defaultUserCode, mappings),
      boilerplateCode: applyFunctionMappings(pythonDetails.boilerplateCodeWithPlaceholder, mappings),
      testCases: applyMappingsToTestCases(problem.testCases, mappings),
      functionName: applyFunctionMappings(pythonDetails.solutionFunctionNameOrClassName, mappings),
      solutionStructureHint: applyFunctionMappings(pythonDetails.solutionStructureHint, mappings),
    },
    roleFamily: transformResult.roleFamily,
    wasRoleAutoSelected: transformResult.wasRoleAutoSelected,
  };
}

/**
 * Create transformation context for a problem and company.
 * Useful for previewing context without performing full transformation.
 *
 * Note: This is a lower-level function. For full transformations with auto-role
 * selection, use transformProblem() instead.
 *
 * @param problemId - Unique identifier for the problem
 * @param companyId - Unique identifier for the company
 * @param roleFamily - Role for role-specific context (required at this level)
 * @param prefetchedProblem - Optional pre-fetched problem data to avoid redundant DB reads
 * @param prefetchedCompany - Optional pre-fetched company data to avoid redundant DB reads
 * @returns Transformation context or null if data not found
 */
export async function createTransformationContext(
  problemId: string,
  companyId: string,
  roleFamily: RoleFamily,
  prefetchedProblem?: Problem | null,
  prefetchedCompany?: Company | null
) {
  return transformer.createTransformationContext(problemId, companyId, roleFamily, prefetchedProblem, prefetchedCompany);
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
  transformAndPrepareProblem,
  createTransformationContext,
  findMostRelevantCompany,
  parseScenarioIntoSections,
};

export default problemTransformerUtils;
