import { env } from '@config/env.js';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { emergencyRateLimiter } from './resilience.middleware.js';

import { isRedisReady } from '@config/redis.js';

const clientOrigins = env.CLIENT_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * General API Rate Limiter
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'production' ? 100 : 500,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isRedisReady() // Skip if Redis is down (emergency limiter takes over)
});

/**
 * Security Middleware Suite
 * Implements production-grade security headers, CORS, and limits
 */
export const securityMiddleware = [
  // 1. Secure Headers
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: [
          "'self'",
          'https://api.openai.com',
          'https://generativelanguage.googleapis.com'
        ]
      }
    },
    xssFilter: true,
    noSniff: true,
    hidePoweredBy: true,
    frameguard: { action: 'deny' }
  }),

  // 2. CORS configuration
  cors({
    origin(origin, callback) {
      if (!origin || clientOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }),

  // 3. Request Logging & Limits
  express.json({ limit: '1mb' }), // Limit JSON body size
  express.urlencoded({ extended: true, limit: '1mb' }),

  // 4. Rate Limiting
  emergencyRateLimiter, // Fallback for Redis outage
  generalLimiter,

  // 5. Utility Middlewares
  compression(),
  cookieParser(env.JWT_ACCESS_SECRET) // Sign cookies if secret is provided
];
