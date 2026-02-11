import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { withRetry } from '@/lib/shared/withRetry';

// Extended interface for OpenAI request parameters with reasoning support
interface ExtendedChatCompletionCreateParams extends OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  reasoning?: {
    effort: "low" | "medium" | "high";
  };
}

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
            console.warn('Warning: OpenAI API key not found. Set OPENAI_API_KEY or provide key to constructor.');
            return;
        }
        this.client = new OpenAI({ apiKey: effectiveApiKey });
    }

    private ensureClient(): OpenAI {
        if (!this.client) {
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

        const options: OpenAiModelOptions = typeof optionsOrSystemPrompt === 'string'
            ? { systemPrompt: optionsOrSystemPrompt }
            : optionsOrSystemPrompt || {};

        const messages: ChatCompletionMessageParam[] = [];
        if (options.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt });
        }
        messages.push({ role: 'user', content: promptContent });

        return withRetry(
            async () => {
                const requestParams: ExtendedChatCompletionCreateParams = {
                    model: model,
                    messages: messages,
                    ...(options.max_tokens && { max_tokens: options.max_tokens }),
                    temperature: options.temperature || 0.7,
                    ...(options.presence_penalty !== undefined && { presence_penalty: options.presence_penalty }),
                    ...(options.frequency_penalty !== undefined && { frequency_penalty: options.frequency_penalty })
                };

                if (options.thinking_enabled || options.reasoning) {
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
            },
            {
                onRetry: (attempt, error) => {
                    console.warn(`OpenAI API call to ${model} failed (attempt ${attempt}/3), retrying... Error: ${error instanceof Error ? error.message : String(error)}`);
                },
            }
        );
    }
}

// Export default instance
const openAiService = new OpenAiService();
export default openAiService;
