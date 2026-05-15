import { z } from 'zod';

export const registerSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'),
  email: z.string().email().toLowerCase(),
  password: z.string().min(6).max(64)
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(6).max(64)
});

export const demoLoginSchema = z.object({
  role: z.enum(['USER', 'ADMIN', 'COACH', 'MENTOR'])
});

export const verifyEmailSchema = z.object({
  token: z.string().min(24).max(256)
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(24).max(256),
  password: z.string().min(8).max(64)
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().min(1)
});
