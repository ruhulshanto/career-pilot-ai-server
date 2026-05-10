import { requestContext } from '@shared/utils/request-context.js';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

/**
 * Request Context Middleware
 * Generates a unique requestId and initializes AsyncLocalStorage
 */
export const requestContextMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  const userId = req.user?.id;

  requestContext.run({ requestId, userId }, () => {
    next();
  });
};
