import { requestContext } from '@shared/utils/request-context.js';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

/**
 * Request Context Middleware
 * Generates a unique requestId and initializes AsyncLocalStorage
 */
export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  const userId = req.user?.id;
  res.setHeader('x-request-id', requestId);

  requestContext.run({ requestId, userId }, () => {
    next();
  });
};
