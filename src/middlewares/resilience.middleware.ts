import { LRUCache } from 'lru-cache';
import { isRedisReady } from '@config/redis.js';
import { logger } from '@/logging/logger.js';
import type { Request, Response, NextFunction } from 'express';

// Local in-memory cache for emergency rate limiting
// Limited to 5000 unique IPs to prevent memory exhaustion
const localCache = new LRUCache<string, number>({
  max: 5000,
  ttl: 60 * 1000, // 1 minute window
});

const EMERGENCY_LIMIT = 10; // 10 requests per minute during Redis outage

/**
 * Emergency Rate Limiter Middleware
 * Only activates when Redis is down.
 */
export const emergencyRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (isRedisReady()) {
    return next();
  }

  const ip = req.ip || 'unknown';
  const currentCount = localCache.get(ip) || 0;

  if (currentCount >= EMERGENCY_LIMIT) {
    logger.warn({ ip }, 'Emergency rate limit exceeded during Redis outage');
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Emergency rate limiting is active.'
    });
  }

  localCache.set(ip, currentCount + 1);
  next();
};
