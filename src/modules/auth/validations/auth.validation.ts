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
