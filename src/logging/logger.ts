import { env } from '@config/env.js';
import pino from 'pino';
import { requestContext } from '@shared/utils/request-context.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
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

