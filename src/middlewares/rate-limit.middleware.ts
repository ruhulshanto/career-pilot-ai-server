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

export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 3 : 20,
  message: 'Too many password reset attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
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

export const publicAiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 3 : 15,
  message: 'Public AI request limit reached. Please wait a moment before asking another question.',
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

export const spamProtectionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.NODE_ENV === 'production' ? 30 : 120,
  message: 'Too many requests. Please slow down and try again shortly.',
  standardHeaders: true,
  legacyHeaders: false
});
