import { AiClient } from '../clients/ai-client.js';
import { AiResponseParser } from '../parsers/json-response.parser.js';
import { promptManager } from '../prompts/manager.js';
import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiModel
} from '../types.js';
import { z } from 'zod';
import { logger } from '@/logging/logger.js';
import { getRequestId } from '@shared/utils/request-context.js';

export abstract class BaseAiService {
  protected client: AiClient;
  protected defaultModel: AiModel;

  constructor(
    defaultModel: AiModel,
    clientConfig?: ConstructorParameters<typeof AiClient>[0]
  ) {
    this.client = new AiClient(clientConfig);
    this.defaultModel = defaultModel;
  }

  protected async executePrompt(
    promptId: string,
    variables: Record<string, unknown>,
    options?: {
      model?: AiModel;
      responseFormat?: 'json' | 'text';
    }
  ): Promise<AiCompletionResponse> {
    const messages = promptManager.buildPrompt(promptId, variables);
    const model = options?.model ?? this.defaultModel;

    const request: AiCompletionRequest = {
      model,
      messages,
      responseFormat: options?.responseFormat
    };

    const response = await this.client.complete(request);

    // AI Usage Logging (Financial Guardrail)
    logger.info({
      type: 'ai_usage',
      promptId,
      model,
      usage: response.usage,
      requestId: getRequestId()
    }, 'AI generation completed');

    return response;
  }

  protected async executePromptWithSchema<T>(
    promptId: string,
    variables: Record<string, unknown>,
    schema: z.ZodSchema<T>,
    options?: {
      model?: AiModel;
    }
  ): Promise<T> {
    const response = await this.executePrompt(promptId, variables, {
      ...options,
      responseFormat: 'json'
    });

    return AiResponseParser.parseJson(schema, response.content);
  }

  protected async executeRawRequest(
    request: AiCompletionRequest
  ): Promise<AiCompletionResponse> {
    return this.client.complete(request);
  }
}
