import { env } from '@config/env.js';
import { AppError } from '@shared/errors/app-error.js';
import { apiErrorResponse } from '@shared/responses/api-response.js';
import { getRequestId } from '@shared/utils/request-context.js';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

import { logger } from '@/logging/logger.js';

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code:
        'code' in error && typeof error.code === 'string'
          ? error.code
          : undefined,
      cause: error.cause
    };
  }

  return error;
};

const formatZodPath = (path: Array<string | number>) =>
  path.length > 0 ? path.map(String).join('.') : 'body';

const zodValidationDetails = (error: ZodError) => ({
  fieldErrors: error.flatten().fieldErrors,
  formErrors: error.flatten().formErrors,
  issues: error.issues.map((issue) => ({
    field: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code
  }))
});

export const errorMiddleware = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const headerRequestId = req?.headers?.['x-request-id'];
  const requestId =
    getRequestId() ??
    (Array.isArray(headerRequestId) ? headerRequestId[0] : headerRequestId);

  if (error instanceof ZodError) {
    return res.status(400).json(
      apiErrorResponse('Validation failed', {
        code: 'VALIDATION_ERROR',
        details: zodValidationDetails(error),
        requestId
      })
    );
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? error.field === 'photo'
          ? 'Profile photo is too large. Maximum supported size is 2 MB.'
          : 'Uploaded file is too large. Maximum supported size is 5 MB.'
        : error.message;

    logger.warn({ error: serializeError(error) }, 'Resume upload rejected');

    return res.status(400).json(
      apiErrorResponse(message, {
        code: error.code,
        requestId
      })
    );
  }

  if (error instanceof AppError && error.code === 'UNSUPPORTED_RESUME_FILE_TYPE') {
    logger.warn({ error: serializeError(error) }, 'Resume upload rejected');

    return res.status(error.statusCode).json(
      apiErrorResponse(error.message, {
        code: error.code,
        requestId
      })
    );
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error({ error: serializeError(error) }, error.message);
    }

    return res.status(error.statusCode).json(
      apiErrorResponse(error.message, {
        code: error.code,
        details: error.details,
        stack: env.NODE_ENV === 'production' ? undefined : error.stack,
        requestId
      })
    );
  }

  logger.error({ error: serializeError(error) }, 'Unhandled error');

  return res.status(500).json(
    apiErrorResponse('Internal server error', {
      code: 'INTERNAL_SERVER_ERROR',
      stack: env.NODE_ENV === 'production' ? undefined : error instanceof Error ? error.stack : undefined,
      requestId
    })
  );
};
