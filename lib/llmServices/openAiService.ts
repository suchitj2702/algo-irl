import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// Constants for OpenAI Service
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

export class OpenAiService {
    private client: OpenAI;

    constructor(apiKey?: string) {
        const effectiveApiKey = apiKey || process.env.OPENAI_API_KEY;
        if (!effectiveApiKey) {
            throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it to the constructor.');
        }
        this.client = new OpenAI({ apiKey: effectiveApiKey });
    }

    public async callOpenAiModel(model: string, promptContent: string, systemPrompt?: string): Promise<string> {
        let retries = 0;

        const messages: ChatCompletionMessageParam[] = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: promptContent });

        while (retries <= MAX_RETRIES) {
            try {
                const completion = await this.client.chat.completions.create({
                    model: model,
                    messages: messages,
                    // Add other parameters like temperature, max_tokens if needed
                    // temperature: 0.7,
                    // max_tokens: 2048,
                });

                const responseText = completion.choices[0]?.message?.content;

                if (!responseText) {
                    const finishReason = completion.choices[0]?.finish_reason;
                    console.warn(`OpenAI API call to model ${model} returned no text content. Finish Reason: ${finishReason}`);
                    throw new Error(`OpenAI API call failed or returned no text. Finish Reason: ${finishReason}`);
                }
                return responseText;

            } catch (error: any) {
                retries++;
                if (retries > MAX_RETRIES) {
                    console.error(`Failed OpenAI API call to model ${model} after ${MAX_RETRIES} retries. Error: ${error}`);
                    // Consider more specific error formatting for OpenAI if needed
                    if (error.response) { // Check for OpenAI specific error structure
                        console.error('OpenAI API Error Details:', error.response.data);
                    }
                    throw error; // Rethrow original error or format it
                }
                console.warn(`OpenAI API call to ${model} failed (attempt ${retries}/${MAX_RETRIES}), retrying in ${RETRY_DELAY * retries}ms... Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
            }
        }
        throw new Error(`Failed to get response from OpenAI model ${model} after maximum retries`);
    }
}

// Export default instance
export default new OpenAiService(); 