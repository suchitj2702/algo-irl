import Anthropic from '@anthropic-ai/sdk';
import { MessageCreateParamsNonStreaming, ContentBlock, Message } from '@anthropic-ai/sdk/resources/messages';
import axios from 'axios';

export interface ClaudeModelOptions {
  systemPrompt?: string;
  max_tokens?: number;
  thinking_enabled?: boolean;
  thinking?: {
    type: "enabled";
    budget_tokens?: number;
  };
}

export class AnthropicService {
  private client: Anthropic;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // ms
  
  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY
    });
    
    if (!this.client.apiKey) {
      throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass it to the constructor.');
    }
  }

  // This is the primary public method for this service
  public async callClaudeModel(
    model: string, 
    promptContent: string, 
    optionsOrSystemPrompt?: string | ClaudeModelOptions
  ): Promise<string> {
    let retries = 0;
    
    // Handle both legacy string systemPrompt and new options object
    const options: ClaudeModelOptions = typeof optionsOrSystemPrompt === 'string' 
      ? { systemPrompt: optionsOrSystemPrompt }
      : optionsOrSystemPrompt || {};
    
    while (retries <= AnthropicService.MAX_RETRIES) {
        try {
            const messages: { role: 'user', content: string }[] = [{ role: 'user', content: promptContent }];
            
            const requestBody: MessageCreateParamsNonStreaming = {
                model: model,
                max_tokens: options.max_tokens || (model.includes('haiku') ? 2048 : 4096),
                messages: messages,
                ...(options.systemPrompt && { system: options.systemPrompt })
            };
            
            // Use Claude's native thinking parameter
            if (options.thinking_enabled || options.thinking) {
                // @ts-ignore - Type definition might not include thinking yet
                requestBody.thinking = options.thinking || { type: "enabled" };
            }

            const response: Message = await this.client.messages.create(requestBody);

            let responseText = '';
            if (response.content && response.content.length > 0) {
                const textBlock = response.content.find(block => block.type === 'text') as ContentBlock | undefined;
                if (textBlock && textBlock.type === 'text') {
                    responseText = textBlock.text;
                }
            }
            
            if (!responseText) {
                throw new Error('No text content found in Anthropic API response for model ' + model);
            }
            return responseText;

        } catch (error) {
            retries++;
            if (retries > AnthropicService.MAX_RETRIES) {
                console.error(`Failed Anthropic API call to model ${model} after ${AnthropicService.MAX_RETRIES} retries. Error: ${this.formatError(error)}`);
                throw this.formatError(error);
            }
            console.warn(`Anthropic API call to ${model} failed (attempt ${retries}/${AnthropicService.MAX_RETRIES}), retrying in ${AnthropicService.RETRY_DELAY * retries}ms... Error: ${error}`);
            await this.delay(AnthropicService.RETRY_DELAY * retries);
        }
    }
    throw new Error(`Failed to get response from model ${model} after maximum retries`);
  }

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
}

// Export default instance
export default new AnthropicService(); 