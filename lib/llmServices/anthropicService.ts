import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { ProblemDifficulty, LanguageSpecificProblemDetails } from '../../data-types/problem';
import { default as judge0DefaultConfig } from '../code-execution/judge0Config'; // Import Judge0 config

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
    difficulty: ProblemDifficulty;
    categories: string[];
    description: string;
    constraints: string[];
    testCases: Array<{
      stdin: string; // JSON string
      expectedStdout: string; // JSON string
      explanation?: string;
      isSample?: boolean;
    }>;
    solutionApproach: string | null;
    timeComplexity: string | null;
    spaceComplexity: string | null;
    languageSpecificDetails?: {
      python?: LanguageSpecificProblemDetails;
      // Add other languages here in the future
    };
    error?: string;
  }> {
    try {
      const problemSlug = this.extractSlugFromUrl(url);
      if (!problemSlug) {
        return {
          title: "Invalid URL",
          difficulty: "Medium" as ProblemDifficulty,
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
      const problemName = problemSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Get Python version string from Judge0 config
      const pythonVersionString = judge0DefaultConfig.languages.python.name || 'Python (version not specified)'; // Fallback

      const prompt = `Generate structured data for the LeetCode problem "${problemName}" (slug: "${problemSlug}").

Based on your knowledge of this common algorithmic problem, provide the following in a valid JSON format only:
{
  "title": "(string) The full title of the problem.",
  "difficulty": "(string) Easy, Medium, or Hard.",
  "categories": ["(string) Array", "(string) Hash Table"],
  "description": "(string) A detailed problem description. This MUST clearly state the expected function signature or class structure (e.g., for Python using \`typing.List\`: \`from typing import List; def twoSum(nums: List[int], target: int) -> List[int]:\`). Include any helper class definitions (like TreeNode) standard for the problem. If providing code examples within the description, ensure they are formatted as valid JSON strings (e.g., newlines as \\\\n, quotes as \\\\\\", etc.).",
  "constraints": ["(string) 2 <= nums.length <= 10^4", "(string) -10^9 <= nums[i] <= 10^9"],
  "testCases": [ 
    {
      "stdin": "(string) A JSON string representing the input. Example: {\\\\\\\"nums\\\\\\\": [2, 7, 11, 15], \\\\\\\"target\\\\\\\": 9}",
      "expectedStdout": "(string) A JSON string representing the expected output. Example: [0, 1]",
      "isSample": true
    }
  ],
  "solutionApproach": "(string) Detailed explanation of efficient solution approaches. Must not be null or empty. No need to include code.",
  "timeComplexity": "(string) Big O time complexity of optimal solution (e.g., O(n)). Must not be null or empty.",
  "spaceComplexity": "(string) Big O space complexity of optimal solution (e.g., O(1) or O(n)). Must not be null or empty.",
  "languageSpecificDetails": {
    "python": {
      "solutionFunctionNameOrClassName": "(string) e.g., twoSum or Solution",
      "solutionStructureHint": "(string) Python (${pythonVersionString}): Example for Python 3.8 compatibility - \`from typing import List; def twoSum(nums: List[int], target: int) -> List[int]:\` or \`from typing import List; class Solution:\\\\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\`",
      "defaultUserCode": "(string) The MINIMAL skeleton code for the user, compatible with ${pythonVersionString}. For type hints, use the 'typing' module. E.g., \`from typing import List; def twoSum(nums: List[int], target: int) -> List[int]:\\\\n    pass\` or \`from typing import List; class Solution:\\\\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\\\\n        pass\`. NO helper classes or solution logic here.",
      "boilerplateCodeWithPlaceholder": "(string) COMPLETE runnable Python script for Judge0, compatible with ${pythonVersionString}. It MUST include imports like \`from typing import List, Dict, Optional\` if type hints such as \`List[int]\` are used. Also include other standard imports (json, sys), helper classes (e.g., TreeNode if relevant for the problem), the placeholder \`%%USER_CODE_PYTHON%%\`, robust stdin/stdout JSON handling, and error handling. Example for Two Sum using \`typing.List\`: import json; import sys; from typing import List; # %%USER_CODE_PYTHON%% if __name__ == '__main__': try: input_str = sys.stdin.read(); data = json.loads(input_str); nums_arg = data['nums']; target_arg = data['target']; # Ensure function (e.g. twoSum) is defined by user code; result = twoSum(nums_arg, target_arg); print(json.dumps(result)); except Exception as e: print(f'Execution Error: {str(e)}', file=sys.stderr); sys.exit(1)\\""
    }
  }
}

IMPORTANT INSTRUCTIONS FOR AI:
1.  The entire response MUST be a single, valid JSON object. Do not include any text, explanations, or markdown formatting like \`\`\`json before or after the JSON object.
2.  Every field specified in the structure above MUST be included.
3.  For the 'testCases' field: Generate at least 15-20 diverse test cases. It MUST be a valid JSON array of objects. Each object must be a complete JSON object, and array elements correctly comma-separated. NO TRAILING COMMAS. 'stdin' and 'expectedStdout' fields must be valid JSON STRINGS, meaning special characters (like quotes, newlines) within these strings must be properly escaped (e.g., use \\\\\\\\\\\" for a quote inside the string). Example of a test case object: {\\\"stdin\\\": \\\"{\\\\\\\\\\\"root\\\\\\\\\\\\\": [1,2,3,null,null,4,5]}\\\", \\\"expectedStdout\\\": \\\"[[1],[2,3],[4,5]]\\\", \\\"isSample\\\": true}.
`;

      const response = await this.client.messages.create({
        model: 'claude-3-7-sonnet-20250219', 
        max_tokens: 4096, 
        messages: [{ role: 'user', content: prompt }],
        system: `You are a specialized data generator for algorithm problems.
        You know the details of common LeetCode problems.
        When given a problem name/slug, generate realistic, detailed problem data.
        IMPORTANT: You MUST include comprehensive solution approaches for every problem, providing multiple approaches when applicable.
        Your solution approaches should be detailed, including code examples and explanations of how the solutions work. Every field requested in the prompt MUST be included in your response. Make the problem description detailed and the test cases realistic. Respond ONLY with a single, valid JSON object containing all requested fields. Do not use markdown wrappers like \`\`\`json or any other explanatory text.`
      });
      
      let jsonText = '';
      for (const block of response.content) {
        if (block.type === 'text') { jsonText += block.text; }
      }
      jsonText = jsonText.trim();
      
      let cleanedJsonText = jsonText; // Declare here to be accessible in catch
      let isolatedJsonForLogging = cleanedJsonText; // For logging state after initial isolation

      try {
        // 1. Isolate the main JSON blob aggressively FIRST
        let rawJsonFromLLM = jsonText.trim();
        if (rawJsonFromLLM.startsWith('```json')) {
          rawJsonFromLLM = rawJsonFromLLM.substring(7);
          if (rawJsonFromLLM.endsWith('```')) {
            rawJsonFromLLM = rawJsonFromLLM.substring(0, rawJsonFromLLM.length - 3);
          }
        } else if (rawJsonFromLLM.startsWith('```')) {
          rawJsonFromLLM = rawJsonFromLLM.substring(3);
          if (rawJsonFromLLM.endsWith('```')) {
            rawJsonFromLLM = rawJsonFromLLM.substring(0, rawJsonFromLLM.length - 3);
          }
        }
        rawJsonFromLLM = rawJsonFromLLM.trim();

        const firstBrace = rawJsonFromLLM.indexOf('{');
        const lastBrace = rawJsonFromLLM.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleanedJsonText = rawJsonFromLLM.substring(firstBrace, lastBrace + 1);
        } else {
          console.warn("Could not isolate a primary JSON object from LLM response. Attempting to parse raw response.", rawJsonFromLLM);
          cleanedJsonText = rawJsonFromLLM; // Fallback to the raw text
        }
        isolatedJsonForLogging = cleanedJsonText; // Save state after isolation

        let parseAttempts = 0;
        const maxParseAttempts = 3; 

        while (parseAttempts < maxParseAttempts) {
          let textToParseThisAttempt = cleanedJsonText; // Start with the current state of cleanedJsonText

          try {
            if (parseAttempts === 0) {
              // Attempt 1: Remove BOM, basic trailing commas.
              // Literal newlines and tabs in the JSON structure are fine for JSON.parse,
              // no need to escape them to \n or \t here.
              textToParseThisAttempt = cleanedJsonText 
                .replace(/^\uFEFF/, '')    // Remove BOM
                .replace(/,\s*]/g, "]")
                .replace(/,\s*}/g, "}");
            } else if (parseAttempts === 1) {
              // Attempt 2: More aggressive comma cleanup (comma directly before closing bracket/brace)
              textToParseThisAttempt = cleanedJsonText.replace(/,(?=\s*[}\]])/g, "");
            } else if (parseAttempts === 2) {
              // Attempt 3: Just try to parse the result of the previous cleaning attempts.
            }

            // Log char codes of the first few characters before parsing
            if (textToParseThisAttempt && textToParseThisAttempt.length > 0) {
              let firstChars = "";
              for (let i = 0; i < Math.min(10, textToParseThisAttempt.length); i++) {
                firstChars += `${textToParseThisAttempt.charCodeAt(i)} (${textToParseThisAttempt[i]}) `; 
              }
              console.warn(`Attempt ${parseAttempts + 1} - Char codes of first ~10 chars: [${firstChars.trim()}]`);
            } else {
              console.warn(`Attempt ${parseAttempts + 1} - textToParseThisAttempt is empty or null.`);
            }

            const data = JSON.parse(textToParseThisAttempt); // Try parsing the modified text
            
            return { // Successful parse
              title: data.title || problemName,
              difficulty: data.difficulty || "Medium" as ProblemDifficulty,
              categories: Array.isArray(data.categories) ? data.categories : [],
              description: data.description || `Problem description for ${problemName}`,
              constraints: Array.isArray(data.constraints) ? data.constraints : [],
              testCases: Array.isArray(data.testCases) ? data.testCases.map((tc: any) => ({
                stdin: typeof tc.stdin === 'string' ? tc.stdin : JSON.stringify(tc.stdin),
                expectedStdout: typeof tc.expectedStdout === 'string' ? tc.expectedStdout : JSON.stringify(tc.expectedStdout),
                explanation: tc.explanation || null,
                isSample: typeof tc.isSample === 'boolean' ? tc.isSample : false,
              })) : [],
              solutionApproach: data.solutionApproach || this.generateGenericFallback(problemName),
              timeComplexity: data.timeComplexity || "O(n)",
              spaceComplexity: data.spaceComplexity || "O(n)",
              languageSpecificDetails: data.languageSpecificDetails || { 
                python: { 
                  solutionFunctionNameOrClassName: 'solution', 
                  solutionStructureHint: 'def solution(...):',
                  defaultUserCode: '# Implement here\\npass', 
                  boilerplateCodeWithPlaceholder: 'import sys\\nimport json\\n# %%USER_CODE_PYTHON%%\\nif __name__ == "__main__":\\n    input_data = json.loads(sys.stdin.read())\\n    result = solution(input_data)\\n    print(json.dumps(result))' 
                } 
              },
              error: data.error || null
            };

          } catch (error) {
            console.warn(`JSON parse attempt ${parseAttempts + 1} (0-indexed) failed. Error:`, error);
            // Update cleanedJsonText with the transformations made in this attempt for the NEXT attempt
            cleanedJsonText = textToParseThisAttempt; 
            
            parseAttempts++;
            if (parseAttempts >= maxParseAttempts) {
              console.error("All JSON parsing attempts failed.");
              console.error("Original text from LLM (full):", jsonText);
              console.error("Isolated JSON blob (before iterative fixes, full):", isolatedJsonForLogging);
              // Log the state of cleanedJsonText as it was just before the final failed parse attempt
              console.error("Final text attempted for parsing (full):", cleanedJsonText);
              console.error("Final Parse Error:", error);
              return { 
                title: problemName, 
                difficulty: "Medium" as ProblemDifficulty, 
                categories: [], 
                description: `Failed to parse AI response for ${problemName}. Check logs for details.`, 
                constraints: [], 
                testCases: [], 
                solutionApproach: this.generateGenericFallback(problemName), 
                timeComplexity: "O(n)", 
                spaceComplexity: "O(n)", 
                error: `Failed to parse JSON response after multiple attempts: ${(error as Error).message}` 
              };
            }
            // Log snippet for the next attempt
            console.warn(`Text for next attempt ${parseAttempts + 1} (after current failed attempt ${parseAttempts}'s cleaning):`, cleanedJsonText.substring(0, 500) + "...");
          }
        }
        // Fallback if loop finishes without returning (shouldn't happen with current logic)
        throw new Error("JSON parsing loop exited unexpectedly.");

      } catch (finalError) { // Catch errors from the isolation phase or the loop fallback
        console.error("Critical error during JSON processing pipeline:", finalError);
        console.error("Original text from LLM (full):", jsonText);
        return { 
            title: problemName, 
            difficulty: "Medium" as ProblemDifficulty, 
            categories: [], 
            description: `Critically failed to parse AI response for ${problemName}. Original text: ${jsonText.substring(0, 500)}`, 
            constraints: [], 
            testCases: [], 
            solutionApproach: this.generateGenericFallback(problemName), 
            timeComplexity: "O(n)", 
            spaceComplexity: "O(n)", 
            error: `Critical JSON processing error: ${(finalError as Error).message}` 
        };
      }
    } catch (apiError:any) { // Outer catch for API errors from Anthropic itself
      console.error("Error generating problem data with Anthropic:", apiError);
      return { 
        title: "Error generating problem data", 
        difficulty: "Medium" as ProblemDifficulty, 
        categories: [], 
        description: "Anthropic API error.", 
        constraints: [], 
        testCases: [], 
        solutionApproach: this.generateGenericFallback("Unknown Problem"), 
        timeComplexity: "O(n)", 
        spaceComplexity: "O(n)", 
        error: apiError.message || "Unknown API error"
      };
    }
  }

  /**
   * Generates a generic fallback solution approach
   */
  private generateGenericFallback(problemName: string): string {
    return `Fallback solution approach for \${problemName}. Details should be researched.`;
  }
}

// Export default instance
export default new AnthropicService(); 