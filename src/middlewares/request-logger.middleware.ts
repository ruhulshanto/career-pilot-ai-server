import { env } from '@config/env.js';
import type { Request, Response } from 'express';
import { pinoHttp, stdSerializers } from 'pino-http';

import { logger } from '@/logging/logger.js';

const sensitiveQueryKeys = new Set([
  'accessToken',
  'refreshToken',
  'token',
  'password',
  'code'
]);

const redactSensitiveQueryValue = (key: string, value: unknown) =>
  sensitiveQueryKeys.has(key) ? '[redacted]' : value;

const sanitizeQuery = (query: Request['query']) =>
  Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      key,
      redactSensitiveQueryValue(key, value)
    ])
  );

const sanitizeUrl = (url?: string) => {
  if (!url) return url;

  try {
    const parsedUrl = new URL(url, 'http://career-pilot.local');
    for (const key of sensitiveQueryKeys) {
      if (parsedUrl.searchParams.has(key)) {
        parsedUrl.searchParams.set(key, '[redacted]');
      }
    }

    return `${parsedUrl.pathname}${parsedUrl.search}`;
  } catch {
    return url;
  }
};

export const requestLogger = pinoHttp({
  logger,
  serializers: {
    req(req: Request) {
      const serialized = stdSerializers.req(req);

      return {
        ...serialized,
        url: sanitizeUrl(serialized.url),
        query: sanitizeQuery(req.query)
      };
    },
    res: stdSerializers.res,
    err: stdSerializers.err
  },
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
