import { getRedis, isRedisReady } from '@config/redis.js';
import { logger } from '@/logging/logger.js';
import type { DashboardSummary } from '../types/dashboard.types.js';

const DASHBOARD_CACHE_TTL_SECONDS = 180;

const cacheKey = (userId: string) => `dashboard:summary:v4:${userId}`;

export const dashboardCacheService = {
  async get(userId: string): Promise<DashboardSummary | null> {
    if (!isRedisReady()) return null;

    try {
      const cached = await getRedis().get(cacheKey(userId));
      return cached ? (JSON.parse(cached) as DashboardSummary) : null;
    } catch (err) {
      logger.error({ err, userId }, 'Failed to read dashboard summary cache');
      return null;
    }
  },

  async set(userId: string, summary: DashboardSummary): Promise<void> {
    if (!isRedisReady()) return;

    try {
      await getRedis().setex(
        cacheKey(userId),
        DASHBOARD_CACHE_TTL_SECONDS,
        JSON.stringify(summary)
      );
    } catch (err) {
      logger.error({ err, userId }, 'Failed to write dashboard summary cache');
    }
  },

  async invalidate(userId: string): Promise<void> {
    if (!isRedisReady()) return;

    try {
      await getRedis().del(cacheKey(userId));
    } catch (err) {
      logger.error({ err, userId }, 'Failed to invalidate dashboard summary cache');
    }
  }
};
