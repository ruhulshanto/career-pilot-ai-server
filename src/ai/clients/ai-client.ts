import { ApiError } from '@shared/errors/api-error.js';
import { sleep } from '@shared/helpers/utils.js';
import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiError,
  AiProviderName
} from '../types.js';
import { getAiProvider } from '../providers/index.js';

export type AiClientConfig = {
  maxRetries: number;
  timeoutMs: number;
  retryDelayMs: number;
};

export class AiClient {
  private config: AiClientConfig;

  constructor(config: Partial<AiClientConfig> = {}) {
    this.config = {
      maxRetries: 3,
      timeoutMs: 30000, // 30 seconds
      retryDelayMs: 1000,
      ...config
    };
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const provider = getAiProvider(request.model.provider);

    let lastError: AiError | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.executeWithTimeout(
          () => provider.complete(request),
          this.config.timeoutMs
        );

        return result;
      } catch (error) {
        lastError = this.normalizeError(error, request.model.provider);

        if (!lastError.retryable || attempt === this.config.maxRetries) {
          throw new ApiError(
            500,
            `AI completion failed: ${lastError.message}`,
            {
              code: lastError.code,
              details: lastError
            }
          );
        }

        // Wait before retry
        await sleep(this.config.retryDelayMs * attempt);
      }
    }

    throw new ApiError(
      500,
      `AI completion failed after ${this.config.maxRetries} attempts`
    );
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('AI request timed out'));
      }, timeoutMs);

      operation()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeout));
    });
  }

  private normalizeError(error: unknown, provider: AiProviderName): AiError {
    if (error instanceof Error) {
      // Check for common error patterns
      if (error.message.includes('timeout')) {
        return {
          code: 'TIMEOUT',
          message: 'Request timed out',
          provider,
          retryable: true
        };
      }

      if (error.message.includes('rate limit')) {
        return {
          code: 'RATE_LIMIT',
          message: 'Rate limit exceeded',
          provider,
          retryable: true
        };
      }

      if (error.message.includes('quota')) {
        return {
          code: 'QUOTA_EXCEEDED',
          message: 'API quota exceeded',
          provider,
          retryable: false
        };
      }

      if (error.message.includes('invalid api key')) {
        return {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key',
          provider,
          retryable: false
        };
      }

      return {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        provider,
        retryable: true
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error occurred',
      provider,
      retryable: true
    };
  }
}
