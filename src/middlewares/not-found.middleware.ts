import { AppError } from '@shared/errors/app-error.js';
import type { NextFunction, Request, Response } from 'express';

export const notFoundMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  next(
    new AppError({
      statusCode: 404,
      message: `Route not found: ${req.originalUrl}`,
      code: 'ROUTE_NOT_FOUND'
    })
  );
};
