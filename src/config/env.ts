import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().default(5000),
    API_PREFIX: z.string().default('/api/v1'),
    CLIENT_ORIGIN: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    COOKIE_DOMAIN: z.string().default('localhost'),
    OPENAI_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT refresh secret must be different from access secret'
      });
    }

    if (value.NODE_ENV === 'production') {
      for (const secretKey of [
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET'
      ] as const) {
        if (value[secretKey].length < 32) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [secretKey],
            message: `${secretKey} must be at least 32 characters in production`
          });
        }
      }
    }
  });

export const env = envSchema.parse(process.env);
