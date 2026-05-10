import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiProviderName
} from '../types.js';

export abstract class BaseAiProvider {
  abstract readonly name: AiProviderName;
  abstract readonly apiKey: string;

  abstract complete(
    request: AiCompletionRequest
  ): Promise<AiCompletionResponse>;

  protected validateApiKey(): void {
    if (!this.apiKey) {
      throw new Error(`${this.name} API key is not configured`);
    }
  }
}
