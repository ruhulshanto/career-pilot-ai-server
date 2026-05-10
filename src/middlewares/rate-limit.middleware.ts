import rateLimit from 'express-rate-limit';
import { env } from '@config/env.js';

/**
 * Auth Rate Limiter (Brute-force protection)
 * Limits login and registration attempts
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: env.NODE_ENV === 'production' ? 10 : 100, // Strict limit for production
  message: 'Too many authentication attempts, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful logins against the limit
});

/**
 * AI/Chatbot Rate Limiter (Abuse prevention)
 * Prevents rapid-fire requests to expensive AI endpoints
 */
export const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: env.NODE_ENV === 'production' ? 5 : 20,
  message: 'AI request limit reached. Please wait a moment before sending more messages.',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * File Upload Rate Limiter
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: env.NODE_ENV === 'production' ? 5 : 50,
  message: 'Too many file upload attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
