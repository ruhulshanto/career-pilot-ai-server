import { z } from 'zod';

/**
 * Zod schemas for chatbot module validation
 */

export const createSessionSchema = z.object({
  title: z.string().optional(),
  context: z
    .object({
      userProfile: z
        .object({
          name: z.string().optional(),
          role: z.string().optional(),
          level: z.string().optional()
        })
        .optional()
    })
    .optional()
});

export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message is too long'),
  context: z.record(z.any()).optional()
});

export const getSessionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  sortBy: z.enum(['createdAt', 'lastMessageAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const getMessagesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});

export const updateSessionSchema = z.object({
  title: z.string().optional(),
  context: z.record(z.any()).optional()
});

// Type exports for use in services
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetSessionsInput = z.infer<typeof getSessionsQuerySchema>;
export type GetMessagesInput = z.infer<typeof getMessagesQuerySchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
