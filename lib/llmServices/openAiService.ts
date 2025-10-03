import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// Extended interface for OpenAI request parameters with reasoning support
interface ExtendedChatCompletionCreateParams extends OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  reasoning?: {
    effort: "low" | "medium" | "high";
  };
}

// Constants for OpenAI Service
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

export interface OpenAiModelOptions {
    systemPrompt?: string;
    max_tokens?: number;
    thinking_enabled?: boolean;
    reasoning?: {
        effort: "low" | "medium" | "high";
    };
    temperature?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
}

export class OpenAiService {
    private client: OpenAI | null = null;

    constructor(apiKey?: string) {
        const effectiveApiKey = apiKey || process.env.OPENAI_API_KEY;
        if (!effectiveApiKey) {
            // Don't throw immediately - allow lazy initialization
            console.warn('Warning: OpenAI API key not found. Set OPENAI_API_KEY or provide key to constructor.');
            return;
        }
        this.client = new OpenAI({ apiKey: effectiveApiKey });
    }

    private ensureClient(): OpenAI {
        if (!this.client) {
            // Try one more time in case env was set after construction
            const key = process.env.OPENAI_API_KEY;
            if (key) {
                this.client = new OpenAI({ apiKey: key });
            } else {
                throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it to the constructor.');
            }
        }
        return this.client;
    }

    public async callOpenAiModel(
        model: string,
        promptContent: string,
        optionsOrSystemPrompt?: string | OpenAiModelOptions
    ): Promise<string> {
        const client = this.ensureClient();
        let retries = 0;

        // Handle both legacy string systemPrompt and new options object
        const options: OpenAiModelOptions = typeof optionsOrSystemPrompt === 'string' 
            ? { systemPrompt: optionsOrSystemPrompt }
            : optionsOrSystemPrompt || {};

        const messages: ChatCompletionMessageParam[] = [];
        if (options.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt });
        }
        messages.push({ role: 'user', content: promptContent });

        while (retries <= MAX_RETRIES) {
            try {
                const requestParams: ExtendedChatCompletionCreateParams = {
                    model: model,
                    messages: messages,
                    ...(options.max_tokens && { max_tokens: options.max_tokens }),
                    temperature: options.temperature || 0.7,
                    ...(options.presence_penalty !== undefined && { presence_penalty: options.presence_penalty }),
                    ...(options.frequency_penalty !== undefined && { frequency_penalty: options.frequency_penalty })
                };
                
                // Add reasoning parameter for newer models that support it
                if (options.thinking_enabled || options.reasoning) {
                    // Use native OpenAI reasoning parameter
                    // This works with o1, o2, o4, and newer GPT-4 models
                    requestParams.reasoning = options.reasoning || { effort: "medium" };
                }

                const completion = await client.chat.completions.create(requestParams);

                const responseText = completion.choices[0]?.message?.content;

                if (!responseText) {
                    const finishReason = completion.choices[0]?.finish_reason;
                    console.warn(`OpenAI API call to model ${model} returned no text content. Finish Reason: ${finishReason}`);
                    throw new Error(`OpenAI API call failed or returned no text. Finish Reason: ${finishReason}`);
                }
                return responseText;

            } catch (error: unknown) {
                retries++;
                if (retries > MAX_RETRIES) {
                    console.error(`Failed OpenAI API call to model ${model} after ${MAX_RETRIES} retries. Error: ${error}`);
                    // Consider more specific error formatting for OpenAI if needed
                    if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response) { // Check for OpenAI specific error structure
                        console.error('OpenAI API Error Details:', (error.response as {data: unknown}).data);
                    }
                    throw error; // Rethrow original error or format it
                }
                console.warn(`OpenAI API call to ${model} failed (attempt ${retries}/${MAX_RETRIES}), retrying in ${RETRY_DELAY * retries}ms... Error: ${error instanceof Error ? error.message : String(error)}`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
            }
        }
        throw new Error(`Failed to get response from OpenAI model ${model} after maximum retries`);
    }
}

// Export default instance
const openAiService = new OpenAiService();
export default openAiService; 