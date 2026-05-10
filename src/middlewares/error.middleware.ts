import { env } from '@config/env.js';
import { AppError } from '@shared/errors/app-error.js';
import { apiErrorResponse } from '@shared/responses/api-response.js';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { logger } from '@/logging/logger.js';

export const errorMiddleware = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (error instanceof ZodError) {
    return res.status(400).json(
      apiErrorResponse('Validation failed', {
        code: 'VALIDATION_ERROR',
        details: error.flatten()
      })
    );
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error({ error }, error.message);
    }

    return res.status(error.statusCode).json(
      apiErrorResponse(error.message, {
        code: error.code,
        details: error.details,
        stack: env.NODE_ENV === 'production' ? undefined : error.stack
      })
    );
  }

  logger.error({ error }, 'Unhandled error');

  return res.status(500).json(
    apiErrorResponse('Internal server error', {
      code: 'INTERNAL_SERVER_ERROR',
      stack: env.NODE_ENV === 'production' ? undefined : error instanceof Error ? error.stack : undefined
    })
  );
};
