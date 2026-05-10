import { ApiError } from '@shared/errors/api-error.js';
import { z } from 'zod';

export class AiResponseParser {
  static parseJson<T>(schema: z.ZodSchema<T>, content: string): T {
    try {
      // Try to extract JSON from the response if it's wrapped in text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;

      const parsed = JSON.parse(jsonString);
      return schema.parse(parsed);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ApiError(500, 'AI response validation failed', {
          code: 'INVALID_AI_RESPONSE',
          details: error.errors
        });
      }

      throw new ApiError(500, 'Failed to parse AI response as JSON', {
        code: 'JSON_PARSE_ERROR',
        details: error
      });
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
