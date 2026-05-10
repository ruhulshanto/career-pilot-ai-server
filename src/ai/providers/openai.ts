import { env } from '@config/env.js';
import type { AiCompletionRequest, AiCompletionResponse } from '../types.js';
import { BaseAiProvider } from './base.js';

export class OpenAiProvider extends BaseAiProvider {
  readonly name = 'openai' as const;
  readonly apiKey = env.OPENAI_API_KEY || '';

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    this.validateApiKey();

    // Assuming OpenAI SDK is available
    // const openai = new OpenAI({ apiKey: this.apiKey });
    // const response = await openai.chat.completions.create({
    //   model: request.model.model,
    //   messages: request.messages,
    //   temperature: request.temperature ?? request.model.temperature ?? 0.7,
    //   max_tokens: request.maxTokens ?? request.model.maxTokens,
    //   response_format: request.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    // });

    // Stub implementation - replace with actual SDK call
    await this.simulateDelay();

    return {
      content: `{"stubbed": "openai-response", "model": "${request.model.model}"}`,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      },
      finishReason: 'stop'
    };
  }

  private async simulateDelay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 100));
  }
}
