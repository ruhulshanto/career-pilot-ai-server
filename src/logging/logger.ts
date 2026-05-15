import { env } from '@config/env.js';
import pino from 'pino';
import { requestContext } from '@shared/utils/request-context.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.query.accessToken',
      'req.query.refreshToken',
      'req.query.token',
      'req.query.password',
      'req.query.code',
      'res.headers["set-cookie"]',
      'password',
      '*.password',
      'token',
      '*.token',
      'accessToken',
      '*.accessToken',
      'refreshToken',
      '*.refreshToken',
      'SMTP_PASS',
      'GROQ_API_KEY',
      'CHATBOT_GROQ_API_KEY'
    ],
    censor: '[redacted]'
  },
  mixin: () => {
    const store = requestContext.getStore();
    return store ? { requestId: store.requestId } : {};
  },
  transport:
    env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' }
        }
});
