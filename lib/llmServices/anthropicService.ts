import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in ms

// Types
interface ScenarioCache {
  [key: string]: {
    scenario: string;
    timestamp: number;
  };
}

interface CompanyDataCache {
  [key: string]: {
    data: string;
    timestamp: number;
  };
}

interface TransformOptions {
  problem: {
    title: string;
    description: string;
    difficulty: string;
    constraints?: string[];
  };
  company: string;
  useCache?: boolean;
}

// In-memory cache
const scenarioCache: ScenarioCache = {};
const companyDataCache: CompanyDataCache = {};

/**
 * AnthropicService - Handles integration with Anthropic API for transforming coding problems
 * into company-specific interview scenarios
 */
export class AnthropicService {
  private client: Anthropic;
  
  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY
    });
    
    if (!this.client.apiKey) {
      throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass it to the constructor.');
    }
  }
  
  /**
   * Transforms leetcode style questions into company-specific interview scenarios using a pre-built prompt
   */
  async transformWithCustomPrompt({ 
    customPrompt, 
    cacheKey, 
    useCache = true 
  }: { 
    customPrompt: string; 
    cacheKey: string;
    useCache?: boolean;
  }): Promise<string> {
    // Check cache if enabled
    if (useCache && scenarioCache[cacheKey]) {
      const cached = scenarioCache[cacheKey];
      const now = Date.now();
      
      // Return cached response if it's still valid
      if (now - cached.timestamp < CACHE_EXPIRY) {
        return cached.scenario;
      }
    }
    
    // Call API with retry mechanism
    let retries = 0;
    while (retries <= MAX_RETRIES) {
      try {
        const response = await this.client.messages.create({
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: 1024,
          messages: [
            { role: 'user', content: customPrompt }
          ],
          system: `You are an expert technical interviewer who specializes in creating algorithm and data structure problems for software engineering interviews. 
          Your task is to transform coding problems into realistic company-specific interview scenarios while preserving their algorithmic essence.
          Your scenarios should feel like actual questions a candidate would receive in a technical interview, with appropriate domain-specific framing that aligns with the company's business and technology.`
        });
        
        // Extract the text from the first content block
        let scenario = '';
        for (const block of response.content) {
          if (block.type === 'text') {
            scenario = block.text;
            break;
          }
        }
        
        if (!scenario) {
          throw new Error('No text content found in Anthropic API response');
        }
        
        // Store in cache
        if (useCache) {
          scenarioCache[cacheKey] = {
            scenario,
            timestamp: Date.now()
          };
        }
        
        return scenario;
      } catch (error) {
        retries++;
        
        // If we've reached max retries, throw the error
        if (retries > MAX_RETRIES) {
          throw this.formatError(error);
        }
        
        // Wait before retrying
        await this.delay(RETRY_DELAY * retries);
      }
    }
    
    throw new Error('Failed to transform problem after maximum retries');
  }

  /**
   * Generates company data using the faster claude-3-5-haiku model
   * Specifically designed for use with generateCompanyDataWithAI
   */
  async generateCompanyData({
    customPrompt,
    cacheKey,
    useCache = true
  }: {
    customPrompt: string;
    cacheKey: string;
    useCache?: boolean;
  }): Promise<string> {
    // Check cache if enabled
    if (useCache && companyDataCache[cacheKey]) {
      const cached = companyDataCache[cacheKey];
      const now = Date.now();
      
      // Return cached response if it's still valid
      if (now - cached.timestamp < CACHE_EXPIRY) {
        return cached.data;
      }
    }
    
    // Call API with retry mechanism
    let retries = 0;
    while (retries <= MAX_RETRIES) {
      try {
        const response = await this.client.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          messages: [
            { role: 'user', content: customPrompt }
          ],
          system: `You are an expert data analyst who specializes in providing accurate and structured information about companies.
          Your task is to generate detailed information about companies in JSON format.
          Ensure all responses are factually accurate, concise, and formatted exactly as requested.`
        });
        
        // Extract the text from the first content block
        let data = '';
        for (const block of response.content) {
          if (block.type === 'text') {
            data = block.text;
            break;
          }
        }
        
        if (!data) {
          throw new Error('No text content found in Anthropic API response');
        }
        
        // Store in cache
        if (useCache) {
          companyDataCache[cacheKey] = {
            data,
            timestamp: Date.now()
          };
        }
        
        return data;
      } catch (error) {
        retries++;
        
        // If we've reached max retries, throw the error
        if (retries > MAX_RETRIES) {
          throw this.formatError(error);
        }
        
        // Wait before retrying
        await this.delay(RETRY_DELAY * retries);
      }
    }
    
    throw new Error('Failed to generate company data after maximum retries');
  }
  
  /**
   * Formats error messages for better debugging
   */
  private formatError(error: any): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      
      return new Error(`Anthropic API error (${status}): ${JSON.stringify(data)}`);
    }
    
    return error instanceof Error ? error : new Error(String(error));
  }
  
  /**
   * Simple delay function for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Clears the scenario cache
   */
  clearCache(): void {
    Object.keys(scenarioCache).forEach(key => {
      delete scenarioCache[key];
    });
    Object.keys(companyDataCache).forEach(key => {
      delete companyDataCache[key];
    });
  }

  /**
   * Extracts the problem's title slug from a LeetCode URL.
   * Example: "https://leetcode.com/problems/two-sum/" -> "two-sum"
   * Returns null if the URL is invalid or doesn't match the pattern.
   * This is a duplicate of the function in problemDatastoreUtils.ts to avoid circular dependency
   */
  private extractSlugFromUrl(url: string): string | null {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname !== "leetcode.com") {
        return null;
      }
      const pathParts = parsedUrl.pathname.split('/').filter(part => part !== '');
      if (pathParts.length >= 2 && pathParts[0] === 'problems') {
        return pathParts[1];
      }
      return null;
    } catch (error) {
      console.error(`Error parsing URL ${url}:`, error);
      return null;
    }
  }

  /**
   * Fetches problem data using the problem slug extracted from a LeetCode URL
   * Instead of expecting Claude to visit URLs, we use the slug as context
   */
  async fetchProblemDataFromUrl(url: string): Promise<{
    title: string;
    difficulty: string;
    categories: string[];
    description: string;
    constraints: string[];
    testCases: Array<{
      input: { raw: string };
      output: any;
    }>;
    solutionApproach: string | null;
    timeComplexity: string | null;
    spaceComplexity: string | null;
    error?: string;
  }> {
    try {
      // Extract the problem slug from the URL using the local method
      const problemSlug = this.extractSlugFromUrl(url);
      
      if (!problemSlug) {
        return {
          title: "Invalid URL",
          difficulty: "Medium",
          categories: [],
          description: "Could not extract problem name from URL.",
          constraints: [],
          testCases: [],
          solutionApproach: null,
          timeComplexity: null,
          spaceComplexity: null,
          error: "Failed to extract problem slug from URL"
        };
      }

      // Convert slug to readable name (e.g., "two-sum" -> "Two Sum")
      const problemName = problemSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Build prompt for Claude to generate data based on problem name
      const prompt = `
      Generate structured data for the LeetCode problem "${problemName}" (slug: "${problemSlug}").
      
      Based on your knowledge of this common algorithmic problem, provide the following in a valid JSON format:
      - title: The full title of the problem
      - difficulty: The difficulty level (Easy, Medium, or Hard)
      - categories: Array of likely topic tags/categories
      - description: A detailed problem description
      - constraints: Array of constraints for the problem
      - testCases: Array of example test cases, each with:
        - input: Object with "raw" property containing the input string
        - output: The expected output value
      
      MOST IMPORTANTLY, include the following solution-related fields:
      - solutionApproach: A detailed explanation of efficient solution approaches. Include multiple valid approaches with their respective advantages and disadvantages where applicable. Include code examples in your explanation. This field MUST NOT be null or empty.
      - timeComplexity: The Big O time complexity of the optimal solution (e.g., "O(n)", "O(n log n)")
      - spaceComplexity: The Big O space complexity of the optimal solution (e.g., "O(n)", "O(1)")
      
      Format your response as valid JSON only, nothing else.
      `;

      // Call Claude with the haiku model for efficiency
      const response = await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4096, // Increased to accommodate larger responses with solution approaches
        messages: [
          { role: 'user', content: prompt }
        ],
        system: `You are a specialized data generator for algorithm problems.
        You know the details of common LeetCode problems.
        When given a problem name/slug, generate realistic, detailed problem data.
        IMPORTANT: You MUST include comprehensive solution approaches for every problem, providing multiple approaches when applicable.
        Your solution approaches should be detailed, including code examples and explanations of how the solutions work.
        You must ONLY return a valid JSON object with the requested fields.
        Do not include any explanatory text before or after the JSON.
        Make the problem description detailed and the test cases realistic.
        Every field requested in the prompt MUST be included in your response.`
      });
      
      // Extract the text from the content blocks
      let jsonText = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          jsonText += block.text;
        }
      }
      
      // Clean up the response to extract just the JSON
      jsonText = jsonText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.substring(7);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.substring(0, jsonText.length - 3);
      }
      jsonText = jsonText.trim();
      
      try {
        // Parse the JSON
        const data = JSON.parse(jsonText);
        
        // Add fallback for solution approach if it's missing
        if (!data.solutionApproach) {
          console.warn(`Solution approach missing for problem ${problemSlug}, generating a generic fallback`);
          // Generate a generic fallback solution approach
          data.solutionApproach = this.generateGenericFallback(problemName);
        }
        
        // Use fallbacks for time/space complexity if missing
        if (!data.timeComplexity) {
          data.timeComplexity = "O(n)"; // Reasonable default for many problems
        }
        
        if (!data.spaceComplexity) {
          data.spaceComplexity = "O(n)"; // Reasonable default for many problems
        }
        
        // Validate and return the extracted data
        return {
          title: data.title || problemName,
          difficulty: data.difficulty || "Medium",
          categories: Array.isArray(data.categories) ? data.categories : [],
          description: data.description || `Problem description for ${problemName}`,
          constraints: Array.isArray(data.constraints) ? data.constraints : [],
          testCases: Array.isArray(data.testCases) ? data.testCases : [],
          solutionApproach: data.solutionApproach, // This should now always be populated
          timeComplexity: data.timeComplexity,
          spaceComplexity: data.spaceComplexity,
          error: data.error
        };
      } catch (error: unknown) {
        console.error("Error parsing JSON from Claude response:", error);
        // If JSON parsing fails, return a complete response with fallback solutions
        return {
          title: problemName,
          difficulty: "Medium",
          categories: [],
          description: `The ${problemName} problem from LeetCode.`,
          constraints: [],
          testCases: [],
          solutionApproach: this.generateGenericFallback(problemName),
          timeComplexity: "O(n)",
          spaceComplexity: "O(n)",
          error: `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    } catch (error) {
      console.error("Error generating problem data with Anthropic:", error);
      return {
        title: "Error generating problem data",
        difficulty: "Medium",
        categories: [],
        description: "Failed to generate problem data. Please try again later.",
        constraints: [],
        testCases: [],
        solutionApproach: this.generateGenericFallback("Unknown Problem"),
        timeComplexity: "O(n)",
        spaceComplexity: "O(n)",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generates a generic fallback solution approach
   */
  private generateGenericFallback(problemName: string): string {
    return `
# Solution Approaches for ${problemName}

This is a generic fallback solution because we couldn't retrieve a specific solution for this problem.

## Multiple Approaches

For most algorithm problems, there are typically several approaches with different trade-offs:

### 1. Brute Force Approach
- Examines all possibilities exhaustively
- Typically has higher time complexity
- Usually O(n²) or worse time complexity
- Often O(1) space complexity

### 2. Optimized Approach
- Uses appropriate data structures (hash maps, stacks, queues, etc.)
- Reduces time complexity, often at the cost of increased space complexity
- Typical time complexity: O(n)
- Typical space complexity: O(n)

### 3. Advanced Techniques (if applicable)
- Dynamic programming, divide and conquer, or other advanced algorithms
- Balances time and space complexity
- Handles edge cases efficiently

**Note:** For specific implementation details, please research the ${problemName} problem directly.
`;
  }
}

// Export default instance
export default new AnthropicService(); 