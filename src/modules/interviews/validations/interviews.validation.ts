import { z } from 'zod';
import { ProcessingStatus } from '@prisma/client';

export const startInterviewSchema = z.object({
  title: z.string().min(2).max(150),
  roleTarget: z.string().min(2).max(100),
  level: z.string().min(2).max(50).optional(),
  questionCount: z.coerce.number().int().min(1).max(12).optional()
});

export const submitInterviewAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string().min(5).max(2000)
      })
    )
    .min(1),
  transcript: z.string().min(1).optional()
});

export const getInterviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.nativeEnum(ProcessingStatus).optional(),
  roleTarget: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

export const interviewIdParamSchema = z.object({
  id: z.string().cuid()
});
