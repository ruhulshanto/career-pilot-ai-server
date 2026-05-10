import { env } from '@config/env.js';
import type { AiCompletionRequest, AiCompletionResponse } from '../types.js';
import { BaseAiProvider } from './base.js';

export class GeminiProvider extends BaseAiProvider {
  readonly name = 'gemini' as const;
  readonly apiKey = env.GEMINI_API_KEY || '';

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    this.validateApiKey();

    // Assuming Google Generative AI SDK is available
    // const genAI = new GoogleGenerativeAI(this.apiKey);
    // const model = genAI.getGenerativeModel({ model: request.model.model });
    // const result = await model.generateContent({
    //   contents: [{ role: 'user', parts: [{ text: request.messages.map(m => m.content).join('\n') }] }],
    //   generationConfig: {
    //     temperature: request.temperature ?? request.model.temperature ?? 0.7,
    //     maxOutputTokens: request.maxTokens ?? request.model.maxTokens,
    //   },
    // });

    // Stub implementation - replace with actual SDK call
    await this.simulateDelay();

    return {
      content: `{"stubbed": "gemini-response", "model": "${request.model.model}"}`,
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
