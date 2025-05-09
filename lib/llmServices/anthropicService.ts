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
}

// Export default instance
export default new AnthropicService(); 