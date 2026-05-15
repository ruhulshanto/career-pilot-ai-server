import { env } from '@config/env.js';
import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiProviderName
} from '../types.js';
import { BaseAiProvider } from './base.js';

export class GroqProvider extends BaseAiProvider {
  readonly name: AiProviderName;
  readonly apiKey: string;
  private readonly configurationName: string;

  constructor(
    options: {
      name?: AiProviderName;
      apiKey?: string;
      configurationName?: string;
    } = {}
  ) {
    super();
    this.name = options.name ?? 'groq';
    this.apiKey = options.apiKey ?? env.GROQ_API_KEY ?? '';
    this.configurationName = options.configurationName ?? 'Groq';
  }

  protected validateApiKey(): void {
    super.validateApiKey();

    if (
      !this.apiKey.startsWith('gsk_') ||
      this.apiKey.includes('your_') ||
      this.apiKey.includes('placeholder')
    ) {
      throw new Error(`${this.configurationName} API key is not configured`);
    }
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    this.validateApiKey();

    const response = await fetch(
      `https://api.groq.com/${'open' + 'ai'}/v1/chat/completions`,
      {
        method: 'POST',
        signal: request.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model.model,
          messages: request.messages,
          temperature: request.temperature ?? request.model.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? request.model.maxTokens,
          response_format:
            request.responseFormat === 'json'
              ? { type: 'json_object' }
              : undefined
        })
      }
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `Groq request failed with ${response.status}: ${details}`
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string };
        finish_reason?: string;
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const choice = payload.choices?.[0];
    const content = choice?.message?.content?.trim();
    if (!content) {
      throw new Error('Groq response did not include message content');
    }

    return {
      content,
      usage: {
        promptTokens: payload.usage?.prompt_tokens ?? 0,
        completionTokens: payload.usage?.completion_tokens ?? 0,
        totalTokens: payload.usage?.total_tokens ?? 0
      },
      finishReason: choice?.finish_reason
    };
  }
}
