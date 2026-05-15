import { PrismaClient } from '@prisma/client';
import { env } from '@config/env.js';
import { logger } from '@/logging/logger.js';
import { sleep } from '@shared/helpers/utils.js';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

type PrismaErrorListener = {
  $on(event: 'error', listener: (event: unknown) => void): void;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    transactionOptions: {
      maxWait: env.PRISMA_TRANSACTION_MAX_WAIT_MS,
      timeout: env.PRISMA_TRANSACTION_TIMEOUT_MS
    }
  });

const prismaWithListeners = prisma as PrismaErrorListener;
prismaWithListeners.$on('error', (event) => {
  logger.error({ event }, 'Prisma client error');
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export const connectPrismaWithRetry = async () => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= env.PRISMA_CONNECT_RETRIES; attempt++) {
    try {
      await prisma.$connect();
      return;
    } catch (error) {
      lastError = error;
      const isFinalAttempt = attempt === env.PRISMA_CONNECT_RETRIES;

      logger.warn(
        {
          error,
          attempt,
          maxRetries: env.PRISMA_CONNECT_RETRIES,
          retryDelayMs: isFinalAttempt
            ? undefined
            : env.PRISMA_CONNECT_RETRY_DELAY_MS
        },
        'Prisma connection attempt failed'
      );

      if (!isFinalAttempt) {
        await sleep(env.PRISMA_CONNECT_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
};
