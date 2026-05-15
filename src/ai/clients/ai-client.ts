import { ApiError } from '@shared/errors/api-error.js';
import { sleep } from '@shared/helpers/utils.js';
import { logger } from '@/logging/logger.js';
import { getRequestId } from '@shared/utils/request-context.js';
import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiError,
  AiProviderName
} from '../types.js';
import { getAiProvider } from '../providers/index.js';
import { CHATBOT_AI_PROVIDER } from '@config/ai.js';

const quotaBlockedUntilByProvider = new Map<AiProviderName, number>();
const QUOTA_COOLDOWN_MS = 60 * 60 * 1000;
const SERVICE_UNAVAILABLE_COOLDOWN_MS = 10 * 60 * 1000;
export const AI_QUOTA_EXCEEDED_MESSAGE =
  'The AI service is currently experiencing high demand. Please try again later.';
export const AI_SERVICE_UNAVAILABLE_MESSAGE =
  'The AI service is currently experiencing high demand. Please try again later.';

export const isAiProviderQuotaBlocked = (provider: AiProviderName) => {
  const blockedUntil = quotaBlockedUntilByProvider.get(provider);
  if (!blockedUntil) return false;

  if (Date.now() >= blockedUntil) {
    quotaBlockedUntilByProvider.delete(provider);
    return false;
  }

  return true;
};

export const getAiProviderQuotaBlockedUntil = (provider: AiProviderName) =>
  quotaBlockedUntilByProvider.get(provider) ?? null;

const blockAiProvider = (provider: AiProviderName, durationMs: number) => {
  const blockedUntil = Date.now() + durationMs;
  quotaBlockedUntilByProvider.set(provider, blockedUntil);
  return blockedUntil;
};

export type AiClientConfig = {
  maxRetries: number;
  timeoutMs: number;
  retryDelayMs: number;
  unavailableRetryDelayMs: number;
};

export class AiClient {
  private config: AiClientConfig;

  constructor(config: Partial<AiClientConfig> = {}) {
    this.config = {
      maxRetries: 3,
      timeoutMs: 30000, // 30 seconds
      retryDelayMs: 1000,
      unavailableRetryDelayMs: 10000,
      ...config
    };
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    if (isAiProviderQuotaBlocked(request.model.provider)) {
      const blockedUntil = getAiProviderQuotaBlockedUntil(
        request.model.provider
      );
      logger.warn(
        {
          type: 'ai_quota_blocked',
          requestId: getRequestId(),
          provider: request.model.provider,
          model: request.model.model,
          blockedUntil: blockedUntil
            ? new Date(blockedUntil).toISOString()
            : undefined
        },
        'Skipping AI request because provider quota is in cooldown'
      );
      throw new ApiError(429, AI_QUOTA_EXCEEDED_MESSAGE, {
        code: 'QUOTA_EXCEEDED',
        retryAfterMs: blockedUntil
          ? Math.max(0, blockedUntil - Date.now())
          : undefined
      });
    }

    const provider = getAiProvider(request.model.provider);

    let lastError: AiError | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.executeWithTimeout(
          (signal) => provider.complete({ ...request, signal }),
          this.config.timeoutMs
        );

        return result;
      } catch (error) {
        lastError = this.normalizeError(error, request.model.provider);
        logger.warn(
          {
            type: 'ai_request_retry',
            requestId: getRequestId(),
            provider: request.model.provider,
            model: request.model.model,
            attempt,
            maxRetries: this.config.maxRetries,
            code: lastError.code,
            retryable: lastError.retryable,
            nextRetryDelayMs:
              lastError.retryable && attempt < this.config.maxRetries
                ? this.getRetryDelay(lastError.code, attempt)
                : undefined
          },
          'AI request attempt failed'
        );

        if (!lastError.retryable || attempt === this.config.maxRetries) {
          const blockedUntil = this.blockProviderIfNeeded(lastError, request);

          const message =
            lastError.code === 'TIMEOUT'
              ? AI_SERVICE_UNAVAILABLE_MESSAGE
              : lastError.code === 'SERVICE_UNAVAILABLE'
                ? AI_SERVICE_UNAVAILABLE_MESSAGE
                : lastError.code === 'QUOTA_EXCEEDED'
                  ? AI_QUOTA_EXCEEDED_MESSAGE
                  : lastError.code === 'MODEL_NOT_FOUND'
                    ? 'The configured AI model is not available. Please update the AI model and try again.'
                    : lastError.code === 'REQUEST_TOO_LARGE'
                      ? 'The AI request is too large. Please shorten the resume or career goals and try again.'
                      : lastError.code === 'INVALID_API_KEY'
                        ? request.model.provider === CHATBOT_AI_PROVIDER
                          ? 'Chatbot Groq is not configured. Add a valid CHATBOT_GROQ_API_KEY in the backend .env and restart the server.'
                          : 'Groq is not configured. Add a valid GROQ_API_KEY in the backend .env and restart the server.'
                        : `AI completion failed: ${lastError.message}`;
          throw new ApiError(this.statusCodeForError(lastError.code), message, {
            code: lastError.code,
            retryAfterMs: blockedUntil
              ? Math.max(0, blockedUntil - Date.now())
              : undefined,
            blockedUntil: blockedUntil
              ? new Date(blockedUntil).toISOString()
              : undefined,
            details: lastError
          });
        }

        // Wait before retry
        const retryDelay = this.getRetryDelay(lastError.code, attempt);
        await sleep(retryDelay);
      }
    }

    throw new ApiError(
      500,
      `AI completion failed after ${this.config.maxRetries} attempts`
    );
  }

  private async executeWithTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const controller = new AbortController();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        controller.abort();
        reject(new Error('AI request timed out'));
      }, timeoutMs);

      operation(controller.signal)
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeout));
    });
  }

  private normalizeError(error: unknown, provider: AiProviderName): AiError {
    if (error instanceof Error) {
      // Check for common error patterns
      const message = error.message.toLowerCase();

      if (
        message.includes('timeout') ||
        error.name === 'AbortError' ||
        message.includes('aborted')
      ) {
        return {
          code: 'TIMEOUT',
          message: 'AI request is taking longer than expected',
          provider,
          retryable: true
        };
      }

      if (message.includes('rate limit')) {
        return {
          code: 'RATE_LIMIT',
          message: 'Rate limit exceeded',
          provider,
          retryable: true
        };
      }

      if (
        message.includes('503') ||
        message.includes('service unavailable') ||
        message.includes('temporarily unavailable') ||
        message.includes('overloaded') ||
        message.includes('high demand')
      ) {
        return {
          code: 'SERVICE_UNAVAILABLE',
          message: 'AI provider is temporarily unavailable due to high demand',
          provider,
          retryable: true
        };
      }

      if (
        message.includes('404') ||
        message.includes('model_not_found') ||
        message.includes('model not found') ||
        message.includes('does not exist') ||
        message.includes('invalid model')
      ) {
        return {
          code: 'MODEL_NOT_FOUND',
          message: error.message,
          provider,
          retryable: false
        };
      }

      if (
        message.includes('413') ||
        message.includes('request too large') ||
        message.includes('payload too large') ||
        message.includes('too many tokens') ||
        message.includes('token limit') ||
        message.includes('context length')
      ) {
        return {
          code: 'REQUEST_TOO_LARGE',
          message: error.message,
          provider,
          retryable: false
        };
      }

      if (message.includes('quota')) {
        return {
          code: 'QUOTA_EXCEEDED',
          message: 'API quota exceeded',
          provider,
          retryable: false
        };
      }

      if (message.includes('invalid api key')) {
        return {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key',
          provider,
          retryable: false
        };
      }

      if (message.includes('api key is not configured')) {
        return {
          code: 'INVALID_API_KEY',
          message: error.message,
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

  private getRetryDelay(code: string, attempt: number) {
    if (code === 'SERVICE_UNAVAILABLE') {
      return this.config.unavailableRetryDelayMs;
    }

    return this.config.retryDelayMs * attempt;
  }

  private statusCodeForError(code: string) {
    if (code === 'QUOTA_EXCEEDED') return 429;
    if (code === 'REQUEST_TOO_LARGE') return 413;
    if (code === 'SERVICE_UNAVAILABLE' || code === 'TIMEOUT') return 503;
    if (code === 'INVALID_API_KEY') return 503;
    if (code === 'MODEL_NOT_FOUND') return 502;
    return 500;
  }

  private blockProviderIfNeeded(error: AiError, request: AiCompletionRequest) {
    const durationMs =
      error.code === 'QUOTA_EXCEEDED'
        ? QUOTA_COOLDOWN_MS
        : error.code === 'SERVICE_UNAVAILABLE'
          ? SERVICE_UNAVAILABLE_COOLDOWN_MS
          : null;

    if (!durationMs) return null;

    const blockedUntil = blockAiProvider(request.model.provider, durationMs);
    logger.error(
      {
        type:
          error.code === 'QUOTA_EXCEEDED'
            ? 'ai_quota_exceeded'
            : 'ai_service_unavailable_cooldown',
        requestId: getRequestId(),
        provider: request.model.provider,
        model: request.model.model,
        blockedUntil: new Date(blockedUntil).toISOString()
      },
      'AI provider entered cooldown'
    );

    return blockedUntil;
  }
}
