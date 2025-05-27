import { Company } from '@/data-types/company';
import { Problem, ProblemDifficulty } from '@/data-types/problem';
import { getCompanyById, getAllCompanies } from '../company/companyUtils';
import { getProblemById } from './problemDatastoreUtils';
import { transformWithPrompt } from '../llmServices/llmUtils';
import { getTransformation, saveTransformation } from './transformCacheUtils';

/**
 * Represents extracted key information from a problem
 */
interface ExtractedProblemInfo {
  title: string;
  difficulty: ProblemDifficulty;
  description: string;
  constraints: string[];
  categories: string[];
  timeComplexity: string | null;
  spaceComplexity: string | null;
  keywords: string[];
  coreAlgorithms: string[];
  dataStructures: string[];
  defaultUserCode?: string;
  testCases: {
    input: string;
    output: string;
  }[];
}

/**
 * Represents extracted key information from a company
 */
interface ExtractedCompanyInfo {
  name: string;
  domain: string;
  products: string[];
  technologies: string[];
  interviewFocus: string[];
  relevantKeywords: string[];
}

/**
 * Represents enhanced prompt context combining problem and company information
 */
export interface TransformationContext {
  problem: ExtractedProblemInfo;
  company: ExtractedCompanyInfo;
  relevanceScore: number;
  suggestedAnalogyPoints: string[];
}

/**
 * Represents the structured sections of a transformed problem scenario
 */
export interface StructuredScenario {
  title: string;
  background: string;
  problemStatement: string;
  functionSignature: string;
  constraints: string[];
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  requirements: string[];
  functionMapping: Record<string, string>;
}

/**
 * Common data structures and algorithms for keyword extraction
 */
const DATA_STRUCTURES = [
  'Array', 'LinkedList', 'Stack', 'Queue', 'HashMap', 'HashSet', 'HashTable',
  'Tree', 'BinaryTree', 'BinarySearchTree', 'Heap', 'PriorityQueue', 
  'Graph', 'Trie', 'Matrix', 'String'
];

const ALGORITHMS = [
  'BFS', 'DFS', 'BinarySearch', 'Sorting', 'MergeSort', 'QuickSort',
  'DynamicProgramming', 'Recursion', 'Backtracking', 'Greedy', 'TwoPointers',
  'SlidingWindow', 'Hashing', 'Memoization', 'UnionFind', 'TopologicalSort'
];

/**
 * Extracts key information from a problem description
 */
function extractProblemKeywords(problem: Problem): string[] {
  // Combine all text fields for keyword extraction
  const combinedText = `${problem.title} ${problem.description} ${problem.categories.join(' ')}`;
  
  // Convert to lowercase for case-insensitive matching
  const text = combinedText.toLowerCase();
  
  // Patterns to search for
  const patterns = {
    dataStructures: DATA_STRUCTURES.map(ds => ds.toLowerCase()),
    algorithms: ALGORITHMS.map(algo => algo.toLowerCase()),
    commonTerms: ['optimize', 'efficient', 'minimum', 'maximum', 'subarray', 'substring', 'consecutive']
  };
  
  // Extract keywords
  const keywords: string[] = [];
  
  // Check for data structures
  patterns.dataStructures.forEach(ds => {
    if (text.includes(ds)) {
      keywords.push(DATA_STRUCTURES[patterns.dataStructures.indexOf(ds)]);
    }
  });
  
  // Check for algorithms
  patterns.algorithms.forEach(algo => {
    if (text.includes(algo)) {
      keywords.push(ALGORITHMS[patterns.algorithms.indexOf(algo)]);
    }
  });
  
  // Check for common terms
  patterns.commonTerms.forEach(term => {
    if (text.includes(term)) {
      keywords.push(term);
    }
  });
  
  // Add all explicit categories
  problem.categories.forEach(category => {
    if (!keywords.includes(category)) {
      keywords.push(category);
    }
  });
  
  // Check for complexity requirements in description
  if (text.includes('o(n)')) keywords.push('LinearTime');
  if (text.includes('o(1)')) keywords.push('ConstantSpace');
  if (text.includes('o(log n)')) keywords.push('Logarithmic');
  if (text.includes('o(n log n)')) keywords.push('LinearithimicTime');
  
  return [...new Set(keywords)]; // Remove duplicates
}

/**
 * Detects core algorithms used in the problem
 */
function detectCoreAlgorithms(problem: Problem): string[] {
  const combinedText = `${problem.title} ${problem.description} ${problem.categories.join(' ')}`;
  const text = combinedText.toLowerCase();
  const coreAlgorithms: string[] = [];
  
  // Map common problem patterns to algorithms
  const algorithmPatterns = [
    { pattern: /(depth.first|dfs)/, algorithm: 'DepthFirstSearch' },
    { pattern: /(breadth.first|bfs)/, algorithm: 'BreadthFirstSearch' },
    { pattern: /(dynamic.programming|dp)/, algorithm: 'DynamicProgramming' },
    { pattern: /(two.point|2.point)/, algorithm: 'TwoPointers' },
    { pattern: /(sliding.window)/, algorithm: 'SlidingWindow' },
    { pattern: /(binary.search)/, algorithm: 'BinarySearch' },
    { pattern: /(backtrack)/, algorithm: 'Backtracking' },
    { pattern: /(greedy)/, algorithm: 'Greedy' },
    { pattern: /(recursion|recursive)/, algorithm: 'Recursion' },
    { pattern: /(union.find|disjoint.set)/, algorithm: 'UnionFind' },
    { pattern: /(topological.sort)/, algorithm: 'TopologicalSort' },
    { pattern: /(hash|map|dictionary)/, algorithm: 'Hashing' },
    { pattern: /(graph)/, algorithm: 'GraphAlgorithm' },
    { pattern: /(tree)/, algorithm: 'TreeAlgorithm' },
    { pattern: /(sort)/, algorithm: 'Sorting' }
  ];
  
  // Check for each pattern
  algorithmPatterns.forEach(({ pattern, algorithm }) => {
    if (pattern.test(text) && !coreAlgorithms.includes(algorithm)) {
      coreAlgorithms.push(algorithm);
    }
  });
  
  // Add from categories if relevant
  problem.categories.forEach(category => {
    algorithmPatterns.forEach(({ pattern, algorithm }) => {
      if (pattern.test(category.toLowerCase()) && !coreAlgorithms.includes(algorithm)) {
        coreAlgorithms.push(algorithm);
      }
    });
  });
  
  return coreAlgorithms;
}

/**
 * Detects data structures used in the problem
 */
function detectDataStructures(problem: Problem): string[] {
  const combinedText = `${problem.title} ${problem.description} ${problem.categories.join(' ')}`;
  const text = combinedText.toLowerCase();
  const dataStructures: string[] = [];
  
  // Map common problem patterns to data structures
  const dataStructurePatterns = [
    { pattern: /(array|arrays)/, structure: 'Array' },
    { pattern: /(linked.list|linkedlist)/, structure: 'LinkedList' },
    { pattern: /(stack)/, structure: 'Stack' },
    { pattern: /(queue)/, structure: 'Queue' },
    { pattern: /(hash.map|hashmap|hash.table|hashtable)/, structure: 'HashMap' },
    { pattern: /(hash.set|hashset)/, structure: 'HashSet' },
    { pattern: /(tree|trees)/, structure: 'Tree' },
    { pattern: /(binary.tree)/, structure: 'BinaryTree' },
    { pattern: /(binary.search.tree|bst)/, structure: 'BinarySearchTree' },
    { pattern: /(heap)/, structure: 'Heap' },
    { pattern: /(priority.queue)/, structure: 'PriorityQueue' },
    { pattern: /(graph)/, structure: 'Graph' },
    { pattern: /(trie)/, structure: 'Trie' },
    { pattern: /(matrix|grid)/, structure: 'Matrix' },
    { pattern: /(string)/, structure: 'String' }
  ];
  
  // Check for each pattern
  dataStructurePatterns.forEach(({ pattern, structure }) => {
    if (pattern.test(text) && !dataStructures.includes(structure)) {
      dataStructures.push(structure);
    }
  });
  
  // Add from categories if relevant
  problem.categories.forEach(category => {
    dataStructurePatterns.forEach(({ pattern, structure }) => {
      if (pattern.test(category.toLowerCase()) && !dataStructures.includes(structure)) {
        dataStructures.push(structure);
      }
    });
  });
  
  return dataStructures;
}

/**
 * Extract key information from a problem
 */
function extractProblemInfo(problem: Problem): ExtractedProblemInfo {
  const keywords = extractProblemKeywords(problem);
  const coreAlgorithms = detectCoreAlgorithms(problem);
  const dataStructures = detectDataStructures(problem);
  
  // Extract Python specific defaultUserCode if available
  const defaultUserCode = problem.languageSpecificDetails?.python?.defaultUserCode;

  // extract test cases where isSample is true
  const testCases = problem.testCases.filter(testCase => testCase.isSample).map(testCase => ({
    input: testCase.stdin,
    output: testCase.expectedStdout
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
    testCases
  };
}

/**
 * Extract relevant company information for problem context
 */
function extractCompanyInfo(company: Company, problemKeywords: string[]): ExtractedCompanyInfo {
  // Extract keywords that might be relevant to the company
  const relevantKeywords: string[] = [];
  
  // Find relevant technologies
  company.technologies.forEach(tech => {
    problemKeywords.forEach(keyword => {
      if (tech.toLowerCase().includes(keyword.toLowerCase()) || 
          keyword.toLowerCase().includes(tech.toLowerCase())) {
        relevantKeywords.push(tech);
      }
    });
  });
  
  // Find relevant products
  company.products.forEach(product => {
    const productLower = product.toLowerCase();
    problemKeywords.forEach(keyword => {
      if (productLower.includes(keyword.toLowerCase())) {
        relevantKeywords.push(product);
      }
    });
  });
  
  return {
    name: company.name,
    domain: company.domain,
    products: company.products,
    technologies: company.technologies,
    interviewFocus: company.interviewFocus,
    relevantKeywords: [...new Set(relevantKeywords)] // Remove duplicates
  };
}

/**
 * Calculate relevance score between a problem and company
 */
function calculateRelevanceScore(problemInfo: ExtractedProblemInfo, companyInfo: ExtractedCompanyInfo): number {
  let score = 0;
  
  // Check if any company technologies align with problem data structures or algorithms
  companyInfo.technologies.forEach(tech => {
    problemInfo.dataStructures.forEach(ds => {
      if (tech.toLowerCase().includes(ds.toLowerCase()) || 
          ds.toLowerCase().includes(tech.toLowerCase())) {
        score += 2;
      }
    });
    
    problemInfo.coreAlgorithms.forEach(algo => {
      if (tech.toLowerCase().includes(algo.toLowerCase()) || 
          algo.toLowerCase().includes(tech.toLowerCase())) {
        score += 2;
      }
    });
  });
  
  // Check if company interview focus aligns with problem characteristics
  companyInfo.interviewFocus.forEach(focus => {
    if (focus.toLowerCase().includes('algorithm') && problemInfo.coreAlgorithms.length > 0) {
      score += 2;
    }
    if (focus.toLowerCase().includes('data structure') && problemInfo.dataStructures.length > 0) {
      score += 2;
    }
    if (focus.toLowerCase().includes('system design') && 
        (problemInfo.difficulty === 'Hard' || problemInfo.keywords.includes('optimize'))) {
      score += 2;
    }
    if (focus.toLowerCase().includes('scale') && 
        (problemInfo.timeComplexity?.includes('O(n)') || problemInfo.keywords.includes('efficient'))) {
      score += 2;
    }
  });
  
  // Add points for company domain relevance
  const domainLower = companyInfo.domain.toLowerCase();
  problemInfo.keywords.forEach(keyword => {
    if (domainLower.includes(keyword.toLowerCase())) {
      score += 1;
    }
  });
  
  // Additional points for relevant keywords
  score += companyInfo.relevantKeywords.length;
  
  return score;
}

/**
 * Generate suggested analogy points for connecting problem to company context
 */
function generateSuggestedAnalogyPoints(
  problemInfo: ExtractedProblemInfo, 
  companyInfo: ExtractedCompanyInfo
): string[] {
  const analogyPoints: string[] = [];
  
  // Map data structures to company products
  const dataStructureToProductMappings = [
    { 
      dataStructure: 'Array', 
      productPatterns: [
        { pattern: /(search)/, analogy: '${company} search results list' },
        { pattern: /(video|stream)/, analogy: '${company} video recommendations' },
        { pattern: /(product|item|shop)/, analogy: '${company} product catalog' }
      ]
    },
    { 
      dataStructure: 'Graph', 
      productPatterns: [
        { pattern: /(map|navigation)/, analogy: '${company} maps connections between locations' },
        { pattern: /(social|network|connect)/, analogy: '${company} user connections network' },
        { pattern: /(recommendation)/, analogy: '${company} recommendation system' }
      ]
    },
    { 
      dataStructure: 'Tree', 
      productPatterns: [
        { pattern: /(file|document)/, analogy: '${company} file/folder hierarchy' },
        { pattern: /(category|taxonomy)/, analogy: '${company} product category organization' },
        { pattern: /(ui|interface)/, analogy: '${company} UI component hierarchy' }
      ]
    },
    { 
      dataStructure: 'HashMap', 
      productPatterns: [
        { pattern: /(cache|memory)/, analogy: '${company} caching system' },
        { pattern: /(user|profile)/, analogy: '${company} user profile store' },
        { pattern: /(config|setting)/, analogy: '${company} configuration management' }
      ]
    }
  ];
  
  // Generate analogies based on data structures and company products
  problemInfo.dataStructures.forEach(ds => {
    const mapping = dataStructureToProductMappings.find(m => m.dataStructure === ds);
    if (mapping) {
      companyInfo.products.forEach(product => {
        mapping.productPatterns.forEach(({ pattern, analogy }) => {
          if (pattern.test(product.toLowerCase())) {
            analogyPoints.push(analogy.replace('${company}', companyInfo.name));
          }
        });
      });
    }
  });
  
  // Add company-specific contexts
  if (companyInfo.name.toLowerCase() === 'google') {
    if (problemInfo.dataStructures.includes('Tree')) {
      analogyPoints.push('Google\'s PageRank algorithm for organizing search results');
    }
    if (problemInfo.dataStructures.includes('Graph')) {
      analogyPoints.push('Google Maps route finding algorithm');
    }
  } else if (companyInfo.name.toLowerCase() === 'amazon') {
    if (problemInfo.keywords.includes('optimize')) {
      analogyPoints.push('Amazon\'s warehouse optimization algorithms');
    }
    if (problemInfo.dataStructures.includes('HashMap')) {
      analogyPoints.push('Amazon\'s product recommendation system');
    }
  } else if (companyInfo.name.toLowerCase() === 'microsoft') {
    if (problemInfo.dataStructures.includes('Tree')) {
      analogyPoints.push('Microsoft\'s file system directory structure');
    }
    if (problemInfo.keywords.includes('efficient')) {
      analogyPoints.push('Microsoft\'s Azure resource allocation system');
    }
  }
  
  // Ensure we have at least one suggestion
  if (analogyPoints.length === 0) {
    analogyPoints.push(`${companyInfo.name}'s engineering challenges in the ${companyInfo.domain} domain`);
  }
  
  return [...new Set(analogyPoints)]; // Remove duplicates
}

/**
 * Main function to create transformation context for a problem and company
 */
export async function createTransformationContext(
  problemId: string, 
  companyId: string
): Promise<TransformationContext | null> {
  try {
    // Fetch problem and company data
    const problem = await getProblemById(problemId);
    const company = await getCompanyById(companyId);
    
    if (!problem || !company) {
      console.error(`Problem or company not found: ${problemId}, ${companyId}`);
      return null;
    }
    
    // Extract key information
    const problemInfo = extractProblemInfo(problem);
    const companyInfo = extractCompanyInfo(company, problemInfo.keywords);
    
    // Calculate relevance score
    const relevanceScore = calculateRelevanceScore(problemInfo, companyInfo);
    
    // Generate suggested analogy points
    const suggestedAnalogyPoints = generateSuggestedAnalogyPoints(problemInfo, companyInfo);
    
    return {
      problem: problemInfo,
      company: companyInfo,
      relevanceScore,
      suggestedAnalogyPoints
    };
  } catch (error) {
    console.error('Error creating transformation context:', error);
    return null;
  }
}

/**
 * Find the most relevant company for a specific problem
 */
export async function findMostRelevantCompany(problemId: string): Promise<string | null> {
  try {
    // Get the problem data
    const problem = await getProblemById(problemId);
    if (!problem) {
      console.error(`Problem not found: ${problemId}`);
      return null;
    }
    
    // Extract problem info
    const problemInfo = extractProblemInfo(problem);
    
    // Get all companies
    const companies = await getAllCompanies();
    
    let maxScore = -1;
    let mostRelevantCompanyId: string | null = null;
    
    // Calculate relevance for each company
    for (const company of companies) {
      const companyInfo = extractCompanyInfo(company, problemInfo.keywords);
      const score = calculateRelevanceScore(problemInfo, companyInfo);
      
      if (score > maxScore) {
        maxScore = score;
        mostRelevantCompanyId = company.id;
      }
    }
    
    return mostRelevantCompanyId;
  } catch (error) {
    console.error('Error finding most relevant company:', error);
    return null;
  }
}

/**
 * Generate an optimized prompt for the Anthropic API
 */
function generateOptimizedPrompt(context: TransformationContext): string {
  // Extract info for prompt - rename to make it clear this is the extracted problem info
  const { problem: extractedProblem, company, suggestedAnalogyPoints } = context;
  
  // Extract function names from defaultUserCode
  let functionNamesToMap = '';
  if (extractedProblem.defaultUserCode) {
    // Look for function/class definitions in the code
    const funcMatches = extractedProblem.defaultUserCode.match(/def\s+(\w+)\s*\(/g) || [];
    const classMatches = extractedProblem.defaultUserCode.match(/class\s+(\w+)[:(]/g) || [];
    
    const functionNames = funcMatches.map(match => match.replace(/def\s+/, '').replace(/\s*\($/, ''));
    const classNames = classMatches.map(match => match.replace(/class\s+/, '').replace(/[:(]$/, ''));
    
    const allNames = [...functionNames, ...classNames].filter(Boolean);
    
    if (allNames.length > 0) {
      functionNamesToMap = `
SPECIFIC FUNCTIONS/CLASSES TO RENAME:
${allNames.join('\n')}

Make sure your mapping includes ALL of these names from the original code.
`;
    }
  }
  
  // Build the enhanced prompt
  const prompt = `
I need you to transform a coding problem into a company-specific interview scenario for ${company.name}. This should feel like a real technical interview question.

ORIGINAL PROBLEM:
"${extractedProblem.title}" (${extractedProblem.difficulty})
${extractedProblem.description}

${extractedProblem.defaultUserCode ? `
ORIGINAL CODE TEMPLATE:
\`\`\`python
${extractedProblem.defaultUserCode}
\`\`\`
` : ''}

TECHNICAL ANALYSIS:
* Core Algorithms: ${extractedProblem.coreAlgorithms.join(', ') || 'N/A'}
* Data Structures: ${extractedProblem.dataStructures.join(', ') || 'N/A'}
* Time Complexity: ${extractedProblem.timeComplexity || 'Not specified, but maintain the original complexity'}
* Space Complexity: ${extractedProblem.spaceComplexity || 'Not specified, but maintain the original complexity'}

COMPANY CONTEXT:
* ${company.name} specializes in: ${company.domain}
* Key products: ${company.products.join(', ')}
* Technology stack: ${company.technologies.join(', ')}
* Interview focus areas: ${company.interviewFocus.join(', ')}

SUGGESTED COMPANY-SPECIFIC ANALOGIES:
${suggestedAnalogyPoints.map(point => `* ${point}`).join('\n')}

${functionNamesToMap}

YOUR TASK:
Create a realistic interview scenario that a ${company.name} interviewer might present during a technical interview. The scenario MUST:

1. Maintain EXACTLY the same algorithmic approach and logical structure as the original
2. Preserve identical input/output data types (if input is an array of integers, keep it as an array of integers)
3. Include 2-3 clear examples with input→output test cases similar to the original problem. Use the test cases from the original problem ${extractedProblem.testCases.map(testCase => `* Input: ${testCase.input}\n* Output: ${testCase.output}`).join('\n')}
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
4. "## Function Signature" - Code block with the function/class signature and docstring
5. "## Constraints" - List all constraints as bullet points
6. "## Examples" - 2-3 examples with input, output, and explanation
7. "## Requirements" - Time/space complexity and any other technical requirements

Format your response as a cohesive interview question, with an introduction, clear statement of the problem, and the function mapping section at the end.
DON'T CREATE MAPPING IF THE MAPPING IS UNCHANGED FOR SOME VALUE
`;

  return prompt;
}

/**
 * Main function to transform a problem into a company-specific scenario
 */
export async function transformProblem(
  problemId: string,
  companyId: string,
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
    // If caching is enabled, check if we have a cached transformation in Firestore
    if (useCache) {
      const cachedTransformation = await getTransformation(problemId, companyId);
      
      if (cachedTransformation) {
        console.log(`Using cached transformation from Firestore for problem ${problemId} and company ${companyId}`);
        
        // Parse the cached scenario into structured sections
        const structuredScenario = parseScenarioIntoSections(cachedTransformation.scenario);
        
        return {
          structuredScenario,
          contextInfo: cachedTransformation.contextInfo
        };
      }
    }
    
    // No cached transformation found, generate a new one
    const context = await createTransformationContext(problemId, companyId);
    
    if (!context) {
      throw new Error('Failed to create transformation context');
    }
    
    const optimizedPrompt = generateOptimizedPrompt(context);
    
    const transformationSystemPrompt = `You are an expert technical interviewer who specializes in creating algorithm and data structure problems for software engineering interviews. 
          Your task is to transform coding problems into realistic company-specific interview scenarios while preserving their algorithmic essence.
          Your scenarios should feel like actual questions a candidate would receive in a technical interview, with appropriate domain-specific framing that aligns with the company's business and technology.`;

    // Create a cache key for this specific transformation task
    const cacheKey = `transform-prompt-${problemId}-${companyId}`.toLowerCase().replace(/\s+/g, '-');

    // Use the generic utility from llmUtils, now passing cache parameters
    const scenarioText = await transformWithPrompt(
      optimizedPrompt, 
      transformationSystemPrompt,
      cacheKey,               // Pass the generated cacheKey
      useCache                // Pass the useCache flag
    );

    // Parse the scenario text into structured sections
    const structuredScenario = parseScenarioIntoSections(scenarioText);
    
    const result = {
      structuredScenario,
      contextInfo: {
        detectedAlgorithms: context.problem.coreAlgorithms,
        detectedDataStructures: context.problem.dataStructures,
        relevanceScore: context.relevanceScore,
        suggestedAnalogyPoints: context.suggestedAnalogyPoints
      }
    };
    
    // Save the transformation in Firestore for future use
    try {
      await saveTransformation({
        problemId,
        companyId,
        scenario: scenarioText,
        functionMapping: structuredScenario.functionMapping,
        contextInfo: result.contextInfo
      });
      console.log(`Saved transformation for problem ${problemId} and company ${companyId} to Firestore from transformer`);
    } catch (error) {
      // Log the error but continue with the request
      console.error('Error saving transformation to Firestore from transformer:', error);
    }
    
    return result;
  } catch (error) {
    console.error('Error transforming problem:', error);
    throw new Error(`Failed to transform problem: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Export utility functions for use in other modules
 */
export default {
  transformProblem,
  createTransformationContext,
  findMostRelevantCompany,
  extractProblemInfo,
  extractCompanyInfo
};

/**
 * Extracts the title from the scenario text
 */
function extractTitle(scenarioText: string): string {
  const titleMatch = scenarioText.match(/^#\s+(.+?)(?:\n|$)/m);
  return titleMatch ? titleMatch[1].trim() : '';
}

/**
 * Extracts the problem background section from the scenario text
 */
function extractBackground(scenarioText: string): string {
  const backgroundMatch = scenarioText.match(/## Problem Background\s*([\s\S]*?)(?=##|$)/);
  return backgroundMatch ? backgroundMatch[1].trim() : '';
}

/**
 * Extracts the problem statement section from the scenario text
 */
function extractProblemStatement(scenarioText: string): string {
  const problemMatch = scenarioText.match(/## The Problem\s*([\s\S]*?)(?=##|$)/);
  return problemMatch ? problemMatch[1].trim() : '';
}

/**
 * Extracts the function signature section from the scenario text
 */
function extractFunctionSignature(scenarioText: string): string {
  const signatureMatch = scenarioText.match(/## Function Signature\s*([\s\S]*?)(?=##|$)/);
  return signatureMatch ? signatureMatch[1].trim() : '';
}

/**
 * Extracts the constraints section from the scenario text and returns as an array
 */
function extractConstraints(scenarioText: string): string[] {
  const constraintsMatch = scenarioText.match(/## Constraints\s*([\s\S]*?)(?=##|$)/);
  if (!constraintsMatch) return [];
  
  const constraintsText = constraintsMatch[1].trim();
  // First split by bullet points or numbered items
  const items = constraintsText.split(/\n\s*[-*•]\s*|\n\s*\d+\.\s*/)
    .map(item => item.trim())
    .filter(item => item.length > 0);
  
  // Clean any remaining bullet points from the beginning of each item
  return items.map(item => item.replace(/^[-*•]\s*/, '').trim());
}

/**
 * Extracts the examples section from the scenario text and returns as structured objects
 */
function extractExamples(scenarioText: string): Array<{input: string; output: string; explanation?: string}> {
  const examplesMatch = scenarioText.match(/## Examples\s*([\s\S]*?)(?=##|$)/);
  if (!examplesMatch) return [];
  
  const examplesText = examplesMatch[1].trim();
  
  // First try to identify examples by looking for "Example X:" patterns
  const exampleBlocks = examplesText.split(/\s*(?:\*\*)?Example \d+(?:\*\*)?:?\s*/i)
    .map(block => block.trim())
    .filter(block => block.length > 0);
  
  if (exampleBlocks.length > 0) {
    return exampleBlocks.map(block => {
      // Handle examples where each part is on a bullet line
      if (block.match(/^\s*[\-\*•]\s*Input:/mi)) {
        let input = '', output = '', explanation = '';
        
        // Extract bullet-formatted sections
        const inputMatch = block.match(/\s*[\-\*•]\s*Input:?\s*([^\n]*(?:\n(?![\-\*•]\s*(?:Output|Explanation))[^\n]*)*)/i);
        const outputMatch = block.match(/\s*[\-\*•]\s*Output:?\s*([^\n]*(?:\n(?![\-\*•]\s*(?:Input|Explanation))[^\n]*)*)/i);
        const explanationMatch = block.match(/\s*[\-\*•]\s*Explanation:?\s*([^\n]*(?:\n(?![\-\*•]\s*(?:Input|Output))[^\n]*)*)/i);
        
        if (inputMatch) input = inputMatch[1].trim();
        if (outputMatch) output = outputMatch[1].trim();
        if (explanationMatch) explanation = explanationMatch[1].trim();
        
        return { input, output, explanation: explanation || undefined };
      } 
      
      // Standard format
      const inputMatch = block.match(/Input:?\s*([^\n]*(?:\n(?!Output:|Explanation:)[^\n]*)*)/i);
      const outputMatch = block.match(/Output:?\s*([^\n]*(?:\n(?!Input:|Explanation:)[^\n]*)*)/i);
      const explanationMatch = block.match(/Explanation:?\s*([^\n]*(?:\n(?!Input:|Output:)[^\n]*)*)/i);
      
      return {
        input: inputMatch ? inputMatch[1].trim() : '',
        output: outputMatch ? outputMatch[1].trim() : '',
        explanation: explanationMatch ? explanationMatch[1].trim() : undefined
      };
    });
  }
  
  // Alternative approach: Find examples by looking for code blocks or input/output patterns
  const examples = [];
  
  // Look for triple-backtick code blocks, assuming each represents an example
  const codeBlocks = examplesText.match(/```[^`]*```/g);
  if (codeBlocks && codeBlocks.length >= 2) {
    // Group code blocks into pairs (input/output)
    for (let i = 0; i < codeBlocks.length - 1; i += 2) {
      examples.push({
        input: codeBlocks[i].replace(/```(?:python|javascript|java)?\n?|\n?```/g, '').trim(),
        output: codeBlocks[i+1].replace(/```(?:python|javascript|java)?\n?|\n?```/g, '').trim()
      });
    }
    return examples;
  }
  
  // Fallback to searching for "Input:" and "Output:" patterns
  const inputMatches = examplesText.matchAll(/Input:?\s*([^\n]*(?:\n(?!Output:|Explanation:|Example \d+:)[^\n]*)*)/gi);
  const outputMatches = examplesText.matchAll(/Output:?\s*([^\n]*(?:\n(?!Input:|Explanation:|Example \d+:)[^\n]*)*)/gi);
  const explanationMatches = examplesText.matchAll(/Explanation:?\s*([^\n]*(?:\n(?!Input:|Output:|Example \d+:)[^\n]*)*)/gi);
  
  const inputs = Array.from(inputMatches).map(m => m[1].trim());
  const outputs = Array.from(outputMatches).map(m => m[1].trim());
  const explanations = Array.from(explanationMatches).map(m => m[1].trim());
  
  for (let i = 0; i < Math.min(inputs.length, outputs.length); i++) {
    examples.push({
      input: inputs[i],
      output: outputs[i],
      explanation: i < explanations.length ? explanations[i] : undefined
    });
  }
  
  return examples;
}

/**
 * Extracts the requirements section from the scenario text and returns as an array
 */
function extractRequirements(scenarioText: string): string[] {
  const requirementsMatch = scenarioText.match(/## Requirements\s*([\s\S]*?)(?=FUNCTION_MAPPING:|$)/);
  if (!requirementsMatch) return [];
  
  const requirementsText = requirementsMatch[1].trim();
  // First split by bullet points or numbered items
  const items = requirementsText.split(/\n\s*[-*•]\s*|\n\s*\d+\.\s*/)
    .map(item => item.trim())
    .filter(item => item.length > 0);
  
  // Clean any remaining bullet points from the beginning of each item
  return items.map(item => item.replace(/^[-*•]\s*/, '').trim());
}

/**
 * Extracts function mapping from the scenario text
 */
function extractFunctionMapping(scenarioText: string): Record<string, string> {
  const functionMapping: Record<string, string> = {};
  const mappingRegex = /FUNCTION_MAPPING:\s*([\s\S]+?)(?:\n\n|$)/;
  const mappingMatch = scenarioText.match(mappingRegex);
  
  if (mappingMatch && mappingMatch[1]) {
    const mappingLines = mappingMatch[1].trim().split('\n');
    mappingLines.forEach(line => {
      const [original, renamed] = line.split('->').map(part => part.trim());
      if (original && renamed) {
        functionMapping[original] = renamed;
      }
    });
  }
  
  return functionMapping;
}

/**
 * Parse the scenario text into structured sections
 */
function parseScenarioIntoSections(scenarioText: string): StructuredScenario {
  return {
    title: extractTitle(scenarioText),
    background: extractBackground(scenarioText),
    problemStatement: extractProblemStatement(scenarioText),
    functionSignature: extractFunctionSignature(scenarioText),
    constraints: extractConstraints(scenarioText),
    examples: extractExamples(scenarioText),
    requirements: extractRequirements(scenarioText),
    functionMapping: extractFunctionMapping(scenarioText)
  };
} 