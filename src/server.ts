import type { Server } from 'node:http';

import { env } from '@config/env.js';
import { prisma } from '@config/prisma.js';
import { disconnectRedis, getRedis } from '@config/redis.js';

import { app } from '@/app/app.js';
import { logger } from '@/logging/logger.js';
import { closeAllQueues } from '@/queues/index.js';
import { startWorkers, stopWorkers } from '@/workers/index.js';

let server: Server | undefined;
let isShuttingDown = false;
let prismaKeepAliveTimer: NodeJS.Timeout | undefined;

const startPrismaKeepAlive = () => {
  if (prismaKeepAliveTimer) {
    return;
  }

  const intervalMs = Number(process.env.PRISMA_KEEP_ALIVE_INTERVAL_MS ?? 60000);
  prismaKeepAliveTimer = setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      logger.error({ error }, 'Prisma keepalive failed, attempting reconnect');

      try {
        await prisma.$disconnect();
      } catch (disconnectError) {
        logger.warn(
          { disconnectError },
          'Prisma disconnect failed during keepalive recovery'
        );
      }

      try {
        await prisma.$connect();
        logger.info('Prisma reconnected after keepalive failure');
      } catch (reconnectError) {
        logger.error({ reconnectError }, 'Prisma reconnect failed');
      }
    }
  }, intervalMs);

  prismaKeepAliveTimer.unref();
};

const clearPrismaKeepAlive = () => {
  if (prismaKeepAliveTimer) {
    clearInterval(prismaKeepAliveTimer);
    prismaKeepAliveTimer = undefined;
  }
};

const shutdown = async (signal: NodeJS.Signals) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, 'Shutting down application');

  server?.close(async (error) => {
    if (error) {
      logger.error({ error }, 'HTTP server shutdown failed');
      process.exitCode = 1;
    }

    await stopWorkers();
    await closeAllQueues();
    clearPrismaKeepAlive();
    await prisma.$disconnect();
    disconnectRedis();

    process.exit(process.exitCode ?? 0);
  });
};

const bootstrap = async () => {
  await prisma.$connect();
  startPrismaKeepAlive();
  await getRedis().ping();
  startWorkers();

  server = app.listen(env.PORT, () => {
    logger.info(`Backend server running on port ${env.PORT}`);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

bootstrap().catch(async (error) => {
  logger.error({ error }, 'Failed to bootstrap application');
  await prisma.$disconnect();
  disconnectRedis();
  process.exit(1);
});
