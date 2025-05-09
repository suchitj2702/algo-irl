import { Company } from '@/data-types/company';
import { Problem, ProblemDifficulty } from '@/data-types/problem';
import { getCompanyById, getAllCompanies } from '../company/companyUtils';
import { getProblemById } from './problemDatastoreUtils';
import anthropicService from '../llmServices/anthropicService';

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
    dataStructures
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
  // Extract info for prompt
  const { problem, company, suggestedAnalogyPoints } = context;
  
  // Build the enhanced prompt
  const prompt = `
I need you to transform a coding problem into a company-specific interview scenario for ${company.name}. This should feel like a real technical interview question.

ORIGINAL PROBLEM:
"${problem.title}" (${problem.difficulty})
${problem.description}

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
${suggestedAnalogyPoints.map(point => `* ${point}`).join('\n')}

YOUR TASK:
Create a realistic interview scenario that a ${company.name} interviewer might present during a technical interview. The scenario MUST:

1. Maintain EXACTLY the same algorithmic approach and logical structure as the original
2. Preserve identical input/output data types (if input is an array of integers, keep it as an array of integers)
3. Include 2-3 clear examples with input→output test cases similar to the original problem
4. Frame the problem within ${company.name}'s products, services, or technology domain
5. Keep the same time and space complexity requirements
6. Use language that a ${company.name} interviewer would naturally use
7. Be concise, clear, and directly applicable to a technical interview setting
8. If applicable, mention any specific technical aspects of ${company.name} that relate to the problem

IMPORTANT REQUIREMENTS:
* The core problem MUST remain mathematically and logically equivalent to the original
* The problem should sound natural, not forced - like a real interview question
* Include any constraints from the original problem (e.g., size limits, value ranges)
* Name any variables or functions in ways that align with ${company.name}'s tech stack
* If the original has O(n) time complexity, maintain that exact requirement
* Make the scenario realistic - something a ${company.name} engineer might actually work on

Format your response as a cohesive interview question, with an introduction and clear statement of the problem.
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
  scenario: string;
  contextInfo: {
    detectedAlgorithms: string[];
    detectedDataStructures: string[];
    relevanceScore: number;
    suggestedAnalogyPoints: string[];
  };
}> {
  try {
    // Create context with all the enhanced information
    const context = await createTransformationContext(problemId, companyId);
    
    if (!context) {
      throw new Error('Failed to create transformation context');
    }
    
    // Generate the optimized prompt
    const optimizedPrompt = generateOptimizedPrompt(context);

    // Create a cache key based on problem ID and company ID
    const cacheKey = `transform-${problemId}-${companyId}`.toLowerCase().replace(/\s+/g, '-');

    // Use the direct prompt transformation method
    const scenarioText = await anthropicService.transformWithCustomPrompt({
      customPrompt: optimizedPrompt,
      cacheKey,
      useCache
    });

    // Return both the scenario and the context information
    return {
      scenario: scenarioText,
      contextInfo: {
        detectedAlgorithms: context.problem.coreAlgorithms,
        detectedDataStructures: context.problem.dataStructures,
        relevanceScore: context.relevanceScore,
        suggestedAnalogyPoints: context.suggestedAnalogyPoints
      }
    };
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