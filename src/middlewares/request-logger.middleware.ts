import { env } from '@config/env.js';
import type { Request, Response } from 'express';
import { pinoHttp } from 'pino-http';

import { logger } from '@/logging/logger.js';

export const requestLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req: Request) => req.url === `${env.API_PREFIX}/health`
  },
  customLogLevel: (_req: Request, res: Response, error?: Error) => {
    if (error || res.statusCode >= 500) {
      return 'error';
    }

    if (res.statusCode >= 400) {
      return 'warn';
    }

    return env.NODE_ENV === 'production' ? 'info' : 'debug';
  }
});
