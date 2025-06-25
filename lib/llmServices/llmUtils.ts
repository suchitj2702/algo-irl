import { ProblemDifficulty, LanguageSpecificProblemDetails } from '../../data-types/problem';
import anthropicService, { ClaudeModelOptions } from "./anthropicService";
import geminiService, { GeminiModelOptions } from "./geminiService";
import openAiService, { OpenAiModelOptions } from "./openAiService";

/**
 * LLM Services Integration Utilities
 * 
 * This module provides a unified interface for interacting with multiple AI/LLM providers:
 * - Anthropic Claude (advanced reasoning, thinking mode)
 * - Google Gemini (multimodal capabilities)
 * - OpenAI GPT (industry standard, reasoning mode)
 * 
 * Key Features:
 * - Provider-agnostic task execution
 * - Native thinking/reasoning mode support for each provider
 * - Comprehensive caching system
 * - Specialized prompts for problem generation and company data
 * - Error handling and fallback mechanisms
 */

// Define our unified options type based on all service types
export type LlmModelOptions = ClaudeModelOptions | GeminiModelOptions | OpenAiModelOptions;

/**
 * Provider-specific options for Anthropic Claude models.
 * These options leverage Claude's native thinking capabilities for enhanced reasoning.
 * @see https://docs.anthropic.com/claude/reference/messages_post
 */
export interface ClaudeOptions {
  /**
   * Controls the native Claude thinking functionality.
   * When enabled, Claude will show its reasoning process in the response.
   * @example { type: "enabled", budget_tokens: 10000 }
   */
  thinking?: {
    /**
     * The type of thinking to enable. Currently only "enabled" is supported.
     */
    type: "enabled";
    /**
     * Optional token budget for the thinking process.
     * Higher values allow for more elaborate reasoning.
     */
    budget_tokens?: number;
  };
}

/**
 * Provider-specific options for Google Gemini models.
 * These options control Gemini's multimodal and reasoning capabilities.
 * @see https://ai.google.dev/api/rest/v1beta/GenerationConfig
 */
export interface GeminiOptions {
  /**
   * Controls the native Gemini thinking functionality.
   * @example { thinkingBudget: 1024 }
   */
  thinkingConfig?: {
    /**
     * Token budget for the thinking process.
     * Typically between 500-2000 tokens.
     */
    thinkingBudget: number;
  };
  
  /**
   * Controls the temperature setting for Gemini models.
   * Values range from 0.0 (deterministic) to 1.0 (creative).
   * @default 0.7
   */
  temperature?: number;
}

/**
 * Provider-specific options for OpenAI models.
 * These options leverage OpenAI's reasoning modes and fine-tuning capabilities.
 * @see https://platform.openai.com/docs/api-reference/chat/create
 */
export interface OpenAiOptions {
  /**
   * Controls the native OpenAI reasoning functionality.
   * Available in newer models like GPT-4o, o1, and o2.
   * @example { effort: "medium" }
   */
  reasoning?: {
    /**
     * The level of reasoning effort.
     * - "low": Minimal reasoning, fastest response
     * - "medium": Standard reasoning, balanced approach
     * - "high": Extensive reasoning, most thorough
     */
    effort: "low" | "medium" | "high";
  };
  
  /**
   * Controls the temperature setting for OpenAI models.
   * Values range from 0.0 (deterministic) to 2.0 (very creative).
   * @default 0.7
   */
  temperature?: number;
  
  /**
   * Controls the presence penalty. Higher values encourage the model
   * to talk about new topics.
   * @default 0
   */
  presence_penalty?: number;
  
  /**
   * Controls the frequency penalty. Higher values discourage the model
   * from repeating the same words.
   * @default 0
   */
  frequency_penalty?: number;
}

/**
 * Cache configuration and storage for custom prompt responses.
 * Implements a simple in-memory cache with TTL (Time To Live) expiration.
 */
const CUSTOM_PROMPT_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
interface CustomPromptCacheEntry {
  response: string;
  timestamp: number;
}
const customPromptCache: { [key: string]: CustomPromptCacheEntry } = {};

/**
 * System prompt for algorithm problem generation.
 * This prompt instructs the AI to generate comprehensive problem data
 * including test cases, solution approaches, and language-specific details.
 */
export const PROBLEM_GENERATION_SYSTEM_PROMPT = `You are a specialized data generator for algorithm problems.
You know the details of common LeetCode problems.
When given a problem name/slug, generate realistic, detailed problem data.
IMPORTANT: You MUST include comprehensive solution approaches for every problem, providing multiple approaches when applicable.
Your solution approaches should be detailed, including code examples and explanations of how the solutions work. ` +
`Every field requested in the prompt MUST be included in your response. Make the problem description detailed ` +
`and the test cases realistic.`;

/**
 * System prompt for company data generation.
 * This prompt ensures accurate and structured company information generation.
 */
export const COMPANY_DATA_SYSTEM_PROMPT = `You are an expert data analyst who specializes in providing accurate and structured information about companies.
Your task is to generate detailed information about companies in JSON format.
Ensure all responses are factually accurate, concise, and formatted exactly as requested.`;

/**
 * Generates a comprehensive prompt for LeetCode problem data generation.
 * This function creates detailed instructions for AI to generate complete problem data
 * including test cases, constraints, solution approaches, and language-specific code.
 * 
 * @param problemName - The display name of the LeetCode problem
 * @param problemSlug - The URL slug identifier for the problem
 * @returns Comprehensive prompt string for AI problem generation
 */
export function getProblemDataGenerationPrompt(problemName: string, problemSlug: string): string {
    // If language/version specific details are needed later, pass context object
    const pythonVersionString = '3.8'; // Use a generic placeholder if needed in string
    return `Generate structured data for the LeetCode problem "${problemName}" (slug: "${problemSlug}").

Based on your knowledge of this common algorithmic problem, provide the following in a valid JSON format only:
{
  "title": "(string) The full title of the problem.",
  "difficulty": "(string) Easy, Medium, or Hard.",
  "categories": ["(string) Array", "(string) Hash Table"],
  "description": "(string) A detailed problem description. This MUST clearly state the expected function signature or class structure ` +
    `(e.g., for Python using \`typing.List\`): \`from typing import List; def twoSum(nums: List[int], target: int) -> List[int]:\`). ` +
    `Include any helper class definitions (like TreeNode) standard for the problem. If providing code examples within the description, ` +
    `ensure they are formatted as valid JSON strings (e.g., newlines as \\\\n, quotes as \\\\\\", etc.).",
  "constraints": ["(string) 2 <= nums.length <= 10^4", "(string) -10^9 <= nums[i] <= 10^9"],
  "testCases": [
    {
      "stdin": "(string) A JSON string representing the input. Example: {\\\\\\\"nums\\\\\\\": [2, 7, 11, 15], \\\\\\\"target\\\\\\\": 9}",
      "expectedStdout": "(string) A JSON string representing the array of expected output. Example: [0, 1]. If there are multiple correct values for a test case, the expectedStdout should be an array of the correct values.",
      "isSample": true
    }
  ],
  "solutionApproach": "(string) Detailed explanation of efficient solution approaches. Must not be null or empty. No need to include code.",
  "timeComplexity": "(string) Big O time complexity of optimal solution (e.g., O(n)). Must not be null or empty.",
  "spaceComplexity": "(string) Big O space complexity of optimal solution (e.g., O(1) or O(n)). Must not be null or empty.",
  "languageSpecificDetails": {
    "python": {
      "solutionFunctionNameOrClassName": "(string) e.g., twoSum or Solution",
      "solutionStructureHint": "(string) Python (${pythonVersionString}): Example for Python 3.8 compatibility - \`from typing import List; ` +
        `def twoSum(nums: List[int], target: int) -> List[int]:\` or \`from typing import List; class Solution:\\\\n    ` +
        `def twoSum(self, nums: List[int], target: int) -> List[int]:\`",
      "defaultUserCode": "(string) The MINIMAL skeleton code for the user, compatible with ${pythonVersionString}. ` +
        `For type hints, use the 'typing' module. E.g., \`from typing import List; def twoSum(nums: List[int], target: int) -> List[int]:\\\\n    pass\` ` +
        `or \`from typing import List; class Solution:\\\\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\\\\n        pass\`. ` +
        `NO helper classes or solution logic here.",
      "boilerplateCodeWithPlaceholder": "(string) COMPLETE runnable Python script for Judge0, compatible with ${pythonVersionString}. ` +
        `It MUST include imports like \`from typing import List, Dict, Optional\` if type hints such as \`List[int]\` are used. ` +
        `Also include other standard imports (json, sys), helper classes (e.g., TreeNode if relevant for the problem), ` +
        `the placeholder \`%%USER_CODE_PYTHON%%\`, robust stdin/stdout JSON handling, and error handling. Example for Two Sum using \`typing.List\`: ` +
        `import json; import sys; from typing import List; %%USER_CODE_PYTHON%% if __name__ == '__main__': try: input_str = sys.stdin.read(); ` +
        `data = json.loads(input_str); nums_arg = data['nums']; target_arg = data['target']; ` +
        `# Ensure function (e.g. twoSum) is defined by user code; result = twoSum(nums_arg, target_arg); print(json.dumps(result)); ` +
        `except Exception as e: print(f'Execution Error: {str(e)}', file=sys.stderr); sys.exit(1)\\"",
      "optimizedSolutionCode": "(string) The COMPLETE and correct solution code for the function/class specified in solutionFunctionNameOrClassName, ` +
        `compatible with ${pythonVersionString}. This code should be ready to be inserted into the boilerplate placeholder and pass all test cases."
    }
  }
}

IMPORTANT INSTRUCTIONS FOR AI:
1.  The entire response MUST be a single, valid JSON object. Do not include any text, explanations, or markdown formatting like \`\`\`json ` +
    `before or after the JSON object.
2.  Every field specified in the structure above MUST be included.
3.  For the 'testCases' field: Generate 15 diverse test cases. It MUST be a valid JSON array of objects. Each object must be ` +
    `a complete JSON object, and array elements correctly comma-separated. NO TRAILING COMMAS. 'stdin' and 'expectedStdout' fields must be ` +
    `valid JSON STRINGS, meaning special characters (like quotes, newlines) within these strings must be properly escaped ` +
    `(e.g., use \\\\\\\\\\\" for a quote inside the string). Example of a test case object: {\\\"stdin\\\": \\\"{\\\\\\\\\\\"root\\\\\\\\\\\\\": [1,2,3,null,null,4,5]}\\\", ` +
    `\\\"expectedStdout\\\": \\\"[[1],[2,3],[4,5]]\\\", \\\"isSample\\\": true}.
4. CRITICAL: The 'testCases' you generate MUST be correct. Verify that the 'expectedStdout' for each test case is the actual output ` +
    `produced when the corresponding 'stdin' is processed by the 'optimizedSolutionCode' you provide for the primary language (Python). ` +
    `Incorrect test cases are unacceptable.
5. For each test case generated, perform a dry run of the 'optimizedSolutionCode' with the 'stdin' to ensure it is correct. IF IT IS NOT CORRECT, REMOVE IT;`  +
`6. If there are multiple correct values for a test case, the expectedStdout should be an array of the correct values.`;
}

/**
 * Generates a generic fallback solution approach when AI generation fails.
 * This function provides a basic solution description as a safety net.
 * 
 * @param problemName - Name of the problem for context
 * @returns Generic fallback solution approach string
 */
export function generateGenericFallback(problemName: string): string {
    return `Fallback solution approach for ${problemName}. Details should be researched.`;
}

/**
 * Supported LLM service providers for the application.
 */
export type LlmServiceType = 'anthropic' | 'gemini' | 'openai';

/**
 * Configuration for an LLM task, specifying the model, parameters, and
 * provider-specific settings for optimal performance.
 */
export interface LlmTaskConfig {
  /**
   * The LLM service provider to use.
   * Each provider has different model capabilities and pricing.
   */
  service: LlmServiceType;
  
  /**
   * The specific model identifier.
   * @example 'claude-3-7-sonnet-20250219' for Anthropic Claude
   * @example 'gemini-1.5-pro-latest' for Google Gemini
   * @example 'gpt-4-turbo' for OpenAI
   */
  model: string;
  
  /**
   * Maximum tokens to generate in the response.
   * This controls the length of the output.
   * Different providers have different token limits.
   * - Claude: 1-4096 for haiku, up to 200k for opus
   * - Gemini: up to 8192 for standard models
   * - OpenAI: varies by model, typically 4096-16k
   */
  max_tokens?: number;
  
  /**
   * Whether to enable model thinking in the response.
   * When true, the model will show its reasoning process
   * using the provider's native thinking implementation.
   * @see ClaudeOptions.thinking
   * @see GeminiOptions.thinkingConfig
   * @see OpenAiOptions.reasoning
   */
  thinking_enabled?: boolean;
  
  /**
   * Anthropic Claude-specific options.
   * Only applied when service is 'anthropic'.
   */
  claude_options?: ClaudeOptions;
  
  /**
   * Google Gemini-specific options.
   * Only applied when service is 'gemini'.
   */
  gemini_options?: GeminiOptions;
  
  /**
   * OpenAI-specific options.
   * Only applied when service is 'openai'.
   */
  openai_options?: OpenAiOptions;
}

/**
 * Predefined configurations for common LLM tasks.
 * Each configuration is optimized for specific use cases with appropriate
 * models, token limits, and thinking capabilities.
 */
export const llmTaskConfigurations: { [taskName: string]: LlmTaskConfig } = {
  problemGeneration: { 
    service: 'anthropic', 
    model: 'claude-3-7-sonnet-20250219',
    max_tokens: 16384,
    thinking_enabled: true,
    claude_options: {
      thinking: {
        type: "enabled",
        budget_tokens: 8192
      }
    }
  },
  companyDataGeneration: { 
    service: 'anthropic', 
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 5000,
    thinking_enabled: false
  },
  customPromptTransform: { 
    service: 'anthropic', 
    model: 'claude-3-7-sonnet-20250219',
    max_tokens: 15000,
    thinking_enabled: true,
    claude_options: {
      thinking: {
        type: "enabled",
        budget_tokens: 10000
      }
    }
  }
};

/**
 * Executes an LLM task by dispatching to the configured service and model.
 * This function provides a unified interface for all AI providers while
 * leveraging each provider's native capabilities and optimizations.
 * 
 * Provider Integration:
 * - Anthropic Claude: Uses thinking mode for complex reasoning tasks
 * - Google Gemini: Leverages multimodal capabilities and thinking config
 * - OpenAI: Utilizes reasoning mode and fine-tuned parameters
 * 
 * @param taskName - The name of the task in llmTaskConfigurations
 * @param prompt - The prompt text to send to the model
 * @param systemPrompt - Optional system prompt to guide model behavior
 * @param options - Optional config overrides including provider-specific options
 * @returns Promise resolving to the model's response as a string
 * @throws Error if task configuration not found or service call fails
 */
export async function executeLlmTask(
    taskName: string, 
    prompt: string, 
    systemPrompt?: string,
    options?: Partial<LlmModelOptions> & {
        claude_options?: ClaudeOptions;
        gemini_options?: GeminiOptions;
        openai_options?: OpenAiOptions;
    }
): Promise<string> {
    const config = llmTaskConfigurations[taskName];
    if (!config) {
        throw new Error(`Configuration for LLM task "${taskName}" not found.`);
    }

    // Start with a base set of options
    const baseOptions: LlmModelOptions = {
        systemPrompt,
        max_tokens: options?.max_tokens ?? config.max_tokens,
        thinking_enabled: options?.thinking_enabled ?? config.thinking_enabled
    };

    // Log basic configuration for debugging
    console.log(`Executing LLM task "${taskName}" using ${config.service} (${config.model})...`);
    if (baseOptions.max_tokens) console.log(`Max tokens: ${baseOptions.max_tokens}`);
    if (baseOptions.thinking_enabled !== undefined) console.log(`Thinking enabled: ${baseOptions.thinking_enabled}`);

    try {
        if (config.service === 'anthropic') {
            // Merge base options with Claude-specific options from both config and override
            const claudeOptions = {
                ...baseOptions,
                // Apply provider-specific options from task config
                ...(config.claude_options && {
                    thinking: config.claude_options.thinking
                }),
                // Apply provider-specific options from function call (overrides config)
                ...(options?.claude_options && {
                    thinking: options.claude_options.thinking
                })
            };
            
            if (claudeOptions.thinking_enabled && !claudeOptions.thinking) {
                // If thinking is enabled but no specific config provided, create a default
                claudeOptions.thinking = {
                    type: "enabled"
                    // No default budget_tokens
                };
            }
            
            return await anthropicService.callClaudeModel(
                config.model, 
                prompt, 
                claudeOptions
            );
        } else if (config.service === 'gemini') {
            // Merge base options with Gemini-specific options from both config and override
            const geminiOptions = {
                ...baseOptions,
                ...(config.gemini_options && config.gemini_options),
                ...(options?.gemini_options && options.gemini_options)
            };
            
            // If thinking is enabled but no thinkingConfig provided, create a default
            if (geminiOptions.thinking_enabled && !geminiOptions.thinkingConfig) {
                geminiOptions.thinkingConfig = {
                    thinkingBudget: 1024 // Default value
                };
            }
            
            return await geminiService.callGeminiModel(
                config.model, 
                prompt, 
                geminiOptions
            );
        } else if (config.service === 'openai') {
            // Merge base options with OpenAI-specific options from both config and override
            const openaiOptions = {
                ...baseOptions,
                ...(config.openai_options && config.openai_options),
                ...(options?.openai_options && options.openai_options)
            };
            
            // If thinking is enabled but no reasoning config provided, create a default
            if (openaiOptions.thinking_enabled && !openaiOptions.reasoning) {
                openaiOptions.reasoning = {
                    effort: "medium" // Default medium effort
                };
            }
            
            return await openAiService.callOpenAiModel(
                config.model, 
                prompt, 
                openaiOptions
            );
        } else {
            // Should be caught by type system, but good practice
            throw new Error(`Unsupported LLM service in configuration: ${config.service}`);
        }
    } catch (error: unknown) {
        console.error(`Error executing LLM task "${taskName}" with ${config.service} (${config.model}):`, error);
        // Re-throw a more informative error
        throw new Error(`LLM task "${taskName}" failed: ${(error instanceof Error ? error.message : String(error))}`);
    }
}

/**
 * Transforms content using a custom prompt with intelligent caching.
 * This function provides a high-level interface for custom AI transformations
 * with automatic caching and expiration management.
 * 
 * Caching Strategy:
 * - In-memory cache with 24-hour TTL
 * - Automatic cache invalidation on expiry
 * - Optional cache bypass for real-time updates
 * - Efficient cache key management
 * 
 * @param customPrompt - The prompt to transform
 * @param systemPrompt - The system prompt to guide model behavior
 * @param cacheKey - Optional key for caching the response
 * @param useCache - Whether to use the cache (default: true)
 * @param options - LLM configuration options including provider-specific settings
 * @returns Promise resolving to the transformed content as a string
 */
export async function transformWithPrompt(
    customPrompt: string,
    systemPrompt: string,
    cacheKey?: string,
    useCache: boolean = true,
    options?: Partial<LlmModelOptions> & {
        claude_options?: ClaudeOptions;
        gemini_options?: GeminiOptions;
        openai_options?: OpenAiOptions;
    }
): Promise<string> {
    if (useCache && cacheKey && customPromptCache[cacheKey]) {
        const cachedEntry = customPromptCache[cacheKey];
        if (Date.now() - cachedEntry.timestamp < CUSTOM_PROMPT_CACHE_EXPIRY) {
            console.log(`Returning cached response for custom prompt: ${cacheKey}`);
            return cachedEntry.response;
        } else {
            // Cache expired, remove it
            delete customPromptCache[cacheKey];
        }
    }

    const response = await executeLlmTask(
        'customPromptTransform', 
        customPrompt, 
        systemPrompt,
        options
    );

    if (useCache && cacheKey) {
        console.log(`Caching response for custom prompt: ${cacheKey}`);
        customPromptCache[cacheKey] = {
            response,
            timestamp: Date.now(),
        };
    }
    return response;
}

/**
 * Generates company data based on a custom prompt using optimized AI configuration.
 * This function uses a lighter, faster model configuration suitable for
 * structured data generation tasks.
 * 
 * @param customPrompt - The prompt describing the company data to generate
 * @param options - Optional LLM configuration overrides
 * @returns Promise resolving to the generated company data as a string
 */
export async function generateCompanyDataWithPrompt(
    customPrompt: string,
    options?: Partial<LlmModelOptions> & {
        claude_options?: ClaudeOptions;
        gemini_options?: GeminiOptions;
        openai_options?: OpenAiOptions;
    }
): Promise<string> {
    return executeLlmTask(
        'companyDataGeneration', 
        customPrompt, 
        COMPANY_DATA_SYSTEM_PROMPT,
        options
    );
}

/**
 * Structured interface for processed problem data after AI generation and validation.
 * This interface ensures type safety and consistency across the problem processing pipeline.
 */
export interface ProcessedProblemData {
    title: string;
    difficulty: ProblemDifficulty;
    categories: string[];
    description: string;
    constraints: string[];
    testCases: Array<{
      stdin: string; // JSON string
      expectedStdout: string; // JSON string
      explanation?: string; // Optional explanation
      isSample?: boolean;
    }>;
    solutionApproach: string | null;
    timeComplexity: string | null;
    spaceComplexity: string | null;
    languageSpecificDetails?: {
      python?: LanguageSpecificProblemDetails;
      // Add other languages here in the future
    };
    error?: string; // Include error field for parsing/processing errors
}

// Consider moving extractSlugFromUrl here
/*
export function extractSlugFromUrl(url: string): string | null { ... }
*/

/**
 * Parses and processes raw LLM response into structured problem data.
 * This function handles JSON parsing, validation, and error handling for
 * AI-generated problem data, ensuring all required fields are present.
 * 
 * @param rawResponse - Raw string response from the LLM
 * @param problemName - Name of the problem for error context
 * @returns ProcessedProblemData object with parsed data or error information
 */
export function parseAndProcessProblemData(
    rawLlmOutput: string,
    problemName: string // For fallback generation
): ProcessedProblemData {
    const jsonText = rawLlmOutput.trim();
    let cleanedJsonText = jsonText;
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
            let textToParseThisAttempt = cleanedJsonText; // Start with the current state

            try {
                if (parseAttempts === 0) {
                    textToParseThisAttempt = cleanedJsonText
                        .replace(/^\\uFEFF/, '')    // Remove BOM
                        .replace(/,\\s*]/g, "]")    // Basic trailing comma removal
                        .replace(/,\\s*}/g, "}");
                } else if (parseAttempts === 1) {
                    // More aggressive comma cleanup
                    textToParseThisAttempt = cleanedJsonText.replace(/,(?=\\s*[}\\]])/g, "");
                }

                const data = JSON.parse(textToParseThisAttempt); // Try parsing

                // Map to ProcessedProblemData structure with fallbacks
                return {
                    title: data.title || problemName,
                    difficulty: data.difficulty || "Medium" as ProblemDifficulty,
                    categories: Array.isArray(data.categories) ? data.categories : [],
                    description: data.description || `Problem description for ${problemName}`,
                    constraints: Array.isArray(data.constraints) ? data.constraints : [],
                    testCases: Array.isArray(data.testCases) ? data.testCases.map((tc: Record<string, unknown>) => ({
                        stdin: typeof tc.stdin === 'string' ? tc.stdin : JSON.stringify(tc.stdin),
                        expectedStdout: typeof tc.expectedStdout === 'string' ? tc.expectedStdout : JSON.stringify(tc.expectedStdout),
                        explanation: (tc.explanation as string) || null, // Keep handling explanation
                        isSample: typeof tc.isSample === 'boolean' ? tc.isSample : false,
                    })) : [],
                    solutionApproach: data.solutionApproach || generateGenericFallback(problemName),
                    timeComplexity: data.timeComplexity || "O(n)",
                    spaceComplexity: data.spaceComplexity || "O(n)",
                    languageSpecificDetails: data.languageSpecificDetails || {
                        python: {
                            solutionFunctionNameOrClassName: 'solution',
                            solutionStructureHint: 'def solution(...):',
                            defaultUserCode: '# Implement here\\npass',
                            boilerplateCodeWithPlaceholder: 'import sys\\nimport json\\n# %%USER_CODE_PYTHON%%\\nif __name__ == "__main__":\\n    input_data = json.loads(sys.stdin.read())\\n    result = solution(input_data)\\n    print(json.dumps(result))',
                            optimizedSolutionCode: '# Fallback optimized solution\\ndef solution(input_data):\\n    return None # Provide a minimal valid function'
                        }
                    },
                    error: data.error || null // Pass through any error reported by the LLM itself in the JSON
                };

            } catch (error) {
                console.warn(`JSON parse attempt ${parseAttempts + 1} (0-indexed) failed. Error:`, error);
                cleanedJsonText = textToParseThisAttempt; // Update for next attempt
                parseAttempts++;
                if (parseAttempts >= maxParseAttempts) {
                    console.error("All JSON parsing attempts failed.");
                    console.error("Original text from LLM (full):", rawLlmOutput);
                    console.error("Isolated JSON blob (before iterative fixes, full):", isolatedJsonForLogging);
                    console.error("Final text attempted for parsing (full):", cleanedJsonText);
                    console.error("Final Parse Error:", error);
                    // Return error structure
                    return {
                        title: problemName,
                        difficulty: "Medium" as ProblemDifficulty,
                        categories: [],
                        description: `Failed to parse AI response for ${problemName}. Check logs for details.`,
                        constraints: [],
                        testCases: [],
                        solutionApproach: generateGenericFallback(problemName),
                        timeComplexity: "O(n)",
                        spaceComplexity: "O(n)",
                        languageSpecificDetails: { // Provide fallback structure
                             python: {
                                solutionFunctionNameOrClassName: 'solution',
                                solutionStructureHint: 'def solution(...):',
                                defaultUserCode: '# Implement here\\npass',
                                boilerplateCodeWithPlaceholder: 'import sys\\nimport json\\n# %%USER_CODE_PYTHON%%\\nif __name__ == "__main__":\\n    input_data = json.loads(sys.stdin.read())\\n    result = solution(input_data)\\n    print(json.dumps(result))',
                                optimizedSolutionCode: '# Fallback optimized solution\\ndef solution(input_data):\\n    return None'
                            }
                        },
                        error: `Failed to parse JSON response after multiple attempts: ${(error as Error).message}`
                    };
                }
                // console.warn(`Text for next attempt ${parseAttempts + 1}:`, cleanedJsonText.substring(0, 200) + "...");
            }
        }
        // Fallback if loop finishes unexpectedly (should not happen)
        throw new Error("JSON parsing loop exited unexpectedly.");

    } catch (finalError) { // Catch errors from isolation phase or loop fallback
        console.error("Critical error during JSON processing pipeline:", finalError);
        console.error("Original text from LLM (full):", rawLlmOutput);
        return {
            title: problemName,
            difficulty: "Medium" as ProblemDifficulty,
            categories: [],
            description: `Critically failed to parse AI response for ${problemName}. Original text: ${rawLlmOutput.substring(0, 500)}`,
            constraints: [],
            testCases: [],
            solutionApproach: generateGenericFallback(problemName),
            timeComplexity: "O(n)",
            spaceComplexity: "O(n)",
            languageSpecificDetails: { // Provide fallback structure
                python: {
                    solutionFunctionNameOrClassName: 'solution',
                    solutionStructureHint: 'def solution(...):',
                    defaultUserCode: '# Implement here\\npass',
                    boilerplateCodeWithPlaceholder: 'import sys\\nimport json\\n# %%USER_CODE_PYTHON%%\\nif __name__ == "__main__":\\n    input_data = json.loads(sys.stdin.read())\\n    result = solution(input_data)\\n    print(json.dumps(result))',
                    optimizedSolutionCode: '# Fallback optimized solution\\ndef solution(input_data):\\n    return None'
                }
            },
            error: `Critical JSON processing error: ${(finalError as Error).message}`
        };
    }
}

// Function to clear specific caches if needed, or all.
export function clearLlmUtilsCache(cacheName?: 'customPrompt' | 'all'): void {
    if (cacheName === 'customPrompt' || cacheName === 'all') {
        Object.keys(customPromptCache).forEach(key => delete customPromptCache[key]);
        console.log("Custom prompt cache cleared.");
    }
    // Add other cache clear logic here if more caches are added
    if (cacheName === 'all') {
        console.log("All llmUtils caches cleared.");
    }
}

