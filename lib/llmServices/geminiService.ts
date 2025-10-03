import { GoogleGenerativeAI, GenerativeModel, GenerateContentResult, GenerationConfig, Part } from "@google/generative-ai";

// Constants for Gemini Service
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

export interface GeminiModelOptions {
    systemPrompt?: string;
    max_tokens?: number;
    thinking_enabled?: boolean;
    thinkingConfig?: {
        thinkingBudget: number;
    };
}

export class GeminiService {
    private client: GoogleGenerativeAI | null = null;
    private modelCache: { [modelName: string]: GenerativeModel } = {};

    constructor(apiKey?: string) {
        const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;
        if (!effectiveApiKey) {
            // Don't throw immediately - allow lazy initialization
            console.warn('Warning: Gemini API key not found. Set GEMINI_API_KEY or provide key to constructor.');
            return;
        }
        this.client = new GoogleGenerativeAI(effectiveApiKey);
    }

    private ensureClient(): GoogleGenerativeAI {
        if (!this.client) {
            // Try one more time in case env was set after construction
            const key = process.env.GEMINI_API_KEY;
            if (key) {
                this.client = new GoogleGenerativeAI(key);
            } else {
                throw new Error('Gemini API key is required. Set GEMINI_API_KEY environment variable or pass it to the constructor.');
            }
        }
        return this.client;
    }

    private getModel(modelName: string, systemInstruction?: string): GenerativeModel {
        const client = this.ensureClient();
        const cacheKey = systemInstruction ? `${modelName}-${systemInstruction}` : modelName;
        if (!this.modelCache[cacheKey]) {
            this.modelCache[cacheKey] = client.getGenerativeModel({
                model: modelName,
                ...(systemInstruction && { systemInstruction })
            });
        }
        return this.modelCache[cacheKey];
    }

    /**
     * Helper function to call Gemini API with retry logic.
     */
    public async callGeminiModel(
        modelName: string, 
        prompt: string, 
        optionsOrSystemPrompt?: string | GeminiModelOptions
    ): Promise<string> {
        let retries = 0;

        // Handle both legacy string systemPrompt and new options object
        const options: GeminiModelOptions = typeof optionsOrSystemPrompt === 'string' 
          ? { systemPrompt: optionsOrSystemPrompt }
          : optionsOrSystemPrompt || {};
        
        const model = this.getModel(modelName, options.systemPrompt);

        const generationConfig: GenerationConfig = {
            temperature: 1,
            // Add max output tokens if specified
            ...(options.max_tokens && { maxOutputTokens: options.max_tokens }),
        };
        
        const userPromptParts: Part[] = [{text: prompt}];

        while (retries <= MAX_RETRIES) {
            try {
                const result: GenerateContentResult = await model.generateContent({
                    contents: [{ role: "user", parts: userPromptParts }],
                    generationConfig: generationConfig,
                });

                const response = result.response;
                const responseText = response.text(); 

                if (!responseText) {
                    const blockReason = response.candidates?.[0]?.finishReason;
                    const safetyRatings = response.candidates?.[0]?.safetyRatings;
                    console.warn(`Gemini API call to model ${modelName} returned no text content. Reason: ${blockReason}. Safety: ${JSON.stringify(safetyRatings)}`);
                    throw new Error(`Gemini API call failed or returned no text. Block Reason: ${blockReason}`);
                }
                return responseText;

            } catch (error: unknown) {
                retries++;
                if (retries > MAX_RETRIES) {
                    console.error(`Failed Gemini API call to model ${modelName} after ${MAX_RETRIES} retries. Error: ${error}`);
                    throw error; 
                }
                console.warn(`Gemini API call to ${modelName} failed (attempt ${retries}/${MAX_RETRIES}), retrying in ${RETRY_DELAY * retries}ms... Error: ${error}`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
            }
        }
        throw new Error(`Failed to get response from Gemini model ${modelName} after maximum retries`);
    }
}

// Export default instance
const geminiService = new GeminiService();
export default geminiService; 