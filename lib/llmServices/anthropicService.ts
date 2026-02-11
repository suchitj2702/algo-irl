import Anthropic from '@anthropic-ai/sdk';
import { MessageCreateParamsNonStreaming, ContentBlock, Message } from '@anthropic-ai/sdk/resources/messages';
import { withRetry } from '@/lib/shared/withRetry';

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
  private client: Anthropic | null = null;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;

    if (!key) {
      console.warn('Warning: Anthropic API key not found. Set ANTHROPIC_API_KEY or provide key to constructor.');
      return;
    }

    this.client = new Anthropic({ apiKey: key });
  }

  private ensureClient(): Anthropic {
    if (!this.client) {
      const key = process.env.ANTHROPIC_API_KEY;
      if (key) {
        this.client = new Anthropic({ apiKey: key });
      } else {
        throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass it to the constructor.');
      }
    }
    return this.client;
  }

  public async callClaudeModel(
    model: string,
    promptContent: string,
    optionsOrSystemPrompt?: string | ClaudeModelOptions
  ): Promise<string> {
    const client = this.ensureClient();

    const options: ClaudeModelOptions = typeof optionsOrSystemPrompt === 'string'
      ? { systemPrompt: optionsOrSystemPrompt }
      : optionsOrSystemPrompt || {};

    return withRetry(
      async () => {
        const messages: { role: 'user', content: string }[] = [{ role: 'user', content: promptContent }];

        const requestBody: MessageCreateParamsNonStreaming = {
          model: model,
          max_tokens: options.max_tokens || (model.includes('haiku') ? 2048 : 4096),
          messages: messages,
          ...(options.systemPrompt && { system: options.systemPrompt })
        };

        if (options.thinking_enabled || options.thinking) {
          // @ts-expect-error - Type definition might not include thinking yet
          requestBody.thinking = options.thinking || { type: "enabled" };
        }

        const response: Message = await client.messages.create(requestBody);

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
      },
      {
        onRetry: (attempt, error) => {
          console.warn(`Anthropic API call to ${model} failed (attempt ${attempt}/3), retrying... Error: ${error}`);
        },
      }
    );
  }
}

// Export default instance
const anthropicService = new AnthropicService();
export default anthropicService;
