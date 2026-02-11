import { GoogleGenerativeAI, GenerativeModel, GenerateContentResult, GenerationConfig, Part } from "@google/generative-ai";
import { withRetry } from '@/lib/shared/withRetry';

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
            console.warn('Warning: Gemini API key not found. Set GEMINI_API_KEY or provide key to constructor.');
            return;
        }
        this.client = new GoogleGenerativeAI(effectiveApiKey);
    }

    private ensureClient(): GoogleGenerativeAI {
        if (!this.client) {
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

    public async callGeminiModel(
        modelName: string,
        prompt: string,
        optionsOrSystemPrompt?: string | GeminiModelOptions
    ): Promise<string> {
        const options: GeminiModelOptions = typeof optionsOrSystemPrompt === 'string'
          ? { systemPrompt: optionsOrSystemPrompt }
          : optionsOrSystemPrompt || {};

        const model = this.getModel(modelName, options.systemPrompt);

        const generationConfig: GenerationConfig = {
            temperature: 1,
            ...(options.max_tokens && { maxOutputTokens: options.max_tokens }),
        };

        const userPromptParts: Part[] = [{text: prompt}];

        return withRetry(
            async () => {
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
            },
            {
                onRetry: (attempt, error) => {
                    console.warn(`Gemini API call to ${modelName} failed (attempt ${attempt}/3), retrying... Error: ${error}`);
                },
            }
        );
    }
}

// Export default instance
const geminiService = new GeminiService();
export default geminiService;
