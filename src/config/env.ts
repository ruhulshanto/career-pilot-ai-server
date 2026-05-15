import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const currentDir = dirname(fileURLToPath(import.meta.url));
const envPath = [
  resolve(process.cwd(), '.env'),
  resolve(currentDir, '../../.env'),
  resolve(currentDir, '../../../.env')
].find((path) => existsSync(path));

dotenv.config({ path: envPath, override: true });

const csvOrigins = (value: string) =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const booleanEnv = z.preprocess((value) => {
  if (typeof value !== 'string') return value;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return value;
}, z.boolean());

const optionalEnv = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') return undefined;
    return value;
  }, schema.optional());

const placeholderPattern =
  /your[._-]|replace_with|placeholder|google_app_password|changeme|example\.com|yourdomain\.com/i;

const looksPlaceholder = (value?: string) =>
  !value || placeholderPattern.test(value);

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().default(5000),
    API_PREFIX: z.string().default('/api/v1'),
    CLIENT_ORIGIN: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    PRISMA_CONNECT_RETRIES: z.coerce.number().int().min(1).default(3),
    PRISMA_CONNECT_RETRY_DELAY_MS: z.coerce.number().int().min(0).default(5000),
    PRISMA_TRANSACTION_MAX_WAIT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .default(20000),
    PRISMA_TRANSACTION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .default(60000),
    REDIS_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    COOKIE_DOMAIN: optionalEnv(z.string()),
    DEMO_LOGIN_ENABLED: booleanEnv.default(false),
    REQUEST_BODY_LIMIT: z.string().default('1mb'),
    PRISMA_KEEP_ALIVE_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(30000)
      .default(60000),
    EMAIL_PROVIDER: z.enum(['gmail']).default('gmail'),
    EMAIL_FROM: optionalEnv(z.string().min(3)),
    EMAIL_REPLY_TO: optionalEnv(z.string().email()),
    SMTP_HOST: z.string().min(1).default('smtp.gmail.com'),
    SMTP_PORT: z.coerce.number().int().positive().default(465),
    SMTP_SECURE: booleanEnv.default(true),
    SMTP_USER: optionalEnv(z.string().email()),
    SMTP_PASS: optionalEnv(z.string().min(1)),
    AI_PROVIDER: z.enum(['groq']).default('groq'),
    GROQ_MODEL: z.string().default('llama-3.1-8b-instant'),
    GROQ_API_KEY: optionalEnv(z.string()),
    CHATBOT_GROQ_MODEL: z.string().default('llama-3.1-8b-instant'),
    CHATBOT_GROQ_API_KEY: optionalEnv(z.string()),
    STORAGE_PROVIDER: z
      .enum(['local', 's3', 'cloudinary', 'supabase'])
      .default('local'),
    UPLOADS_DIR: z.string().default('uploads'),
    UPLOAD_PUBLIC_BASE_URL: optionalEnv(z.string().url())
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
      if (csvOrigins(value.CLIENT_ORIGIN).some((origin) => /localhost|127\.0\.0\.1/i.test(origin))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CLIENT_ORIGIN'],
          message: 'CLIENT_ORIGIN must not contain localhost in production'
        });
      }

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

      if (/localhost|127\.0\.0\.1/i.test(value.REDIS_URL)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['REDIS_URL'],
          message: 'REDIS_URL must point to a production Redis instance in production'
        });
      }

      if (value.COOKIE_DOMAIN && /localhost|127\.0\.0\.1/i.test(value.COOKIE_DOMAIN)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['COOKIE_DOMAIN'],
          message: 'COOKIE_DOMAIN must not be localhost in production'
        });
      }

      if (value.DEMO_LOGIN_ENABLED) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DEMO_LOGIN_ENABLED'],
          message: 'DEMO_LOGIN_ENABLED must be false in production'
        });
      }

      if (value.STORAGE_PROVIDER === 'local' && !value.UPLOAD_PUBLIC_BASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['UPLOAD_PUBLIC_BASE_URL'],
          message:
            'UPLOAD_PUBLIC_BASE_URL is required for local file storage in production'
        });
      }

      if (looksPlaceholder(value.EMAIL_FROM)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_FROM'],
          message: 'EMAIL_FROM must be a real sender address in production'
        });
      }

      if (value.EMAIL_PROVIDER === 'gmail' && !value.SMTP_HOST) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_HOST'],
          message: 'SMTP_HOST is required when EMAIL_PROVIDER=gmail in production'
        });
      }

      if (value.EMAIL_PROVIDER === 'gmail' && !value.SMTP_USER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_USER'],
          message: 'SMTP_USER is required when EMAIL_PROVIDER=gmail in production'
        });
      }

      if (value.EMAIL_PROVIDER === 'gmail' && looksPlaceholder(value.SMTP_PASS)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_PASS'],
          message: 'SMTP_PASS must be a real Gmail App Password in production'
        });
      }

      if (!value.GROQ_API_KEY || looksPlaceholder(value.GROQ_API_KEY)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GROQ_API_KEY'],
          message: 'GROQ_API_KEY must be configured in production'
        });
      }

      if (!value.CHATBOT_GROQ_API_KEY || looksPlaceholder(value.CHATBOT_GROQ_API_KEY)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CHATBOT_GROQ_API_KEY'],
          message: 'CHATBOT_GROQ_API_KEY must be configured in production'
        });
      }
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const diagnostics = parsedEnv.error.issues.map((issue) => ({
    key: issue.path.join('.') || 'environment',
    message: issue.message
  }));

  console.error(
    JSON.stringify(
      {
        level: 'fatal',
        message: 'Invalid production environment configuration',
        diagnostics
      },
      null,
      2
    )
  );

  throw new Error(
    `Invalid environment configuration: ${diagnostics
      .map((item) => `${item.key}: ${item.message}`)
      .join('; ')}`
  );
}

export const env = parsedEnv.data;

export const getEnvironmentDiagnostics = () => {
  const origins = csvOrigins(env.CLIENT_ORIGIN);
  const warnings: string[] = [];

  if (!env.GROQ_API_KEY) warnings.push('GROQ_API_KEY is not configured');
  if (!env.CHATBOT_GROQ_API_KEY) warnings.push('CHATBOT_GROQ_API_KEY is not configured');
  if (!env.EMAIL_FROM) warnings.push('EMAIL_FROM is not configured');
  if (env.EMAIL_PROVIDER === 'gmail') {
    if (!env.SMTP_HOST) warnings.push('SMTP_HOST is not configured');
    if (!env.SMTP_USER) warnings.push('SMTP_USER is not configured');
    if (!env.SMTP_PASS) warnings.push('SMTP_PASS is not configured');
    if (env.SMTP_PASS && looksPlaceholder(env.SMTP_PASS)) {
      warnings.push('SMTP_PASS appears to be a placeholder');
    }
  }
  if (env.NODE_ENV !== 'production') warnings.push('NODE_ENV is not production');
  if (env.DEMO_LOGIN_ENABLED) warnings.push('Demo login is enabled');
  if (env.STORAGE_PROVIDER === 'local') {
    warnings.push('Local file storage is active; configure cloud storage before scaling uploads');
  }

  return {
    nodeEnv: env.NODE_ENV,
    apiPrefix: env.API_PREFIX,
    port: env.PORT,
    clientOrigins: origins,
    storageProvider: env.STORAGE_PROVIDER,
    aiProvider: env.AI_PROVIDER,
    emailProvider: env.EMAIL_PROVIDER,
    demoLoginEnabled: env.DEMO_LOGIN_ENABLED,
    productionReady: env.NODE_ENV === 'production' && warnings.length === 0,
    warnings
  };
};
