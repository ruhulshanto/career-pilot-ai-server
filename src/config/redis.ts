import { env } from '@config/env.js';
import { Redis } from 'ioredis';
import { logger } from '@/logging/logger.js';

let redisClient: Redis | undefined;
let isRedisAvailable = true;
let heartbeatInterval: NodeJS.Timeout | undefined;

export const getRedis = () => {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    redisClient.on('error', (err) => {
      if (isRedisAvailable) {
        logger.error({ err }, 'Redis connection lost. Switching to degraded mode.');
        isRedisAvailable = false;
        startHeartbeat();
      }
    });

    redisClient.on('connect', () => {
      if (!isRedisAvailable) {
        logger.info('Redis connection restored. Resuming normal operations.');
        isRedisAvailable = true;
        stopHeartbeat();
      }
    });
  }

  return redisClient;
};

export const isRedisReady = () => isRedisAvailable;

const startHeartbeat = () => {
  if (heartbeatInterval) return;
  
  heartbeatInterval = setInterval(async () => {
    try {
      await redisClient?.ping();
    } catch {
      // Still down
    }
  }, 5000);
};

const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = undefined;
  }
};

export const disconnectRedis = () => {
  stopHeartbeat();
  redisClient?.disconnect();
};

