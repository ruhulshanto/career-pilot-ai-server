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
import { ApiError } from '@shared/errors/api-error.js';

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
      schemaRetries?: number;
    }
  ): Promise<T> {
    const maxSchemaAttempts = options?.schemaRetries ?? 2;

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxSchemaAttempts; attempt++) {
      const response = await this.executePrompt(promptId, variables, {
        ...options,
        responseFormat: 'json'
      });

      try {
        return AiResponseParser.parseJson(schema, response.content);
      } catch (error) {
        lastError = error;
        if (!this.isRetryableStructuredResponseError(error) || attempt === maxSchemaAttempts) {
          throw error;
        }

        logger.warn(
          {
            type: 'ai_response_parse_retry',
            promptId,
            attempt,
            maxSchemaAttempts,
            requestId: getRequestId(),
            code: error instanceof ApiError ? error.code : undefined
          },
          'Retrying AI prompt because response was not valid structured JSON'
        );
      }
    }

    throw lastError;
  }

  protected async executeRawRequest(
    request: AiCompletionRequest
  ): Promise<AiCompletionResponse> {
    return this.client.complete(request);
  }

  private isRetryableStructuredResponseError(error: unknown) {
    if (!(error instanceof ApiError)) return false;
    return ['EMPTY_AI_RESPONSE', 'JSON_PARSE_ERROR', 'INVALID_AI_RESPONSE'].includes(
      error.code ?? ''
    );
  }
}
