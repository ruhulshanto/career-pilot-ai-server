import { ApiError } from '@shared/errors/api-error.js';
import { logger } from '@/logging/logger.js';
import { getRequestId } from '@shared/utils/request-context.js';
import { z } from 'zod';

export class AiResponseParser {
  static parseJson<T>(schema: z.ZodSchema<T>, content: string): T {
    try {
      const trimmed = content?.trim();
      if (!trimmed) {
        throw new ApiError(
          500,
          'There was an issue processing the AI response. Please try again later.',
          {
            code: 'EMPTY_AI_RESPONSE'
          }
        );
      }

      // Try to extract JSON from the response if it's wrapped in text
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : trimmed;

      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new ApiError(
          500,
          'There was an issue processing the AI response. Please try again later.',
          {
            code: 'INVALID_AI_RESPONSE',
            details: 'AI response was not a JSON object'
          }
        );
      }

      return schema.parse(parsed);
    } catch (error) {
      if (error instanceof ApiError) {
        logger.warn(
          {
            requestId: getRequestId(),
            code: error.code,
            contentPreview: content?.slice(0, 500)
          },
          'AI response JSON parsing failed'
        );
        throw error;
      }

      if (error instanceof z.ZodError) {
        logger.warn(
          {
            requestId: getRequestId(),
            code: 'INVALID_AI_RESPONSE',
            issues: error.errors,
            contentPreview: content?.slice(0, 500)
          },
          'AI response schema validation failed'
        );
        throw new ApiError(
          500,
          'There was an issue processing the AI response. Please try again later.',
          {
            code: 'INVALID_AI_RESPONSE',
            details: error.errors
          }
        );
      }

      logger.warn(
        {
          requestId: getRequestId(),
          code: 'JSON_PARSE_ERROR',
          error,
          contentPreview: content?.slice(0, 500)
        },
        'AI response was not valid JSON'
      );
      throw new ApiError(
        500,
        'There was an issue processing the AI response. Please try again later.',
        {
          code: 'JSON_PARSE_ERROR',
          details: error instanceof Error ? error.message : error
        }
      );
    }
  }

  static parseText(content: string): string {
    return content.trim();
  }

  static extractJsonFromText(text: string): string | null {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : null;
  }
}

// Legacy function for backward compatibility
export const parseStructuredAiResponse = <T>(
  schema: z.ZodSchema<T>,
  payload: unknown
) => schema.parse(payload);
