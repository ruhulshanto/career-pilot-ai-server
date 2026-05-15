import { z } from 'zod';
const interviewStatusValues = [
  'SCHEDULED',
  'ACTIVE',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
] as const;

export const startInterviewSchema = z.object({
  title: z.string().min(2).max(150),
  roleTarget: z.string().min(2).max(100),
  level: z.string().min(2).max(50).optional(),
  questionCount: z.coerce.number().int().min(1).max(12).optional(),
  scheduledAt: z.string().datetime().optional()
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
  status: z.enum(interviewStatusValues).optional(),
  roleTarget: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

export const getInterviewSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().int().min(1).max(14).optional(),
  roleTarget: z.string().min(2).max(100).optional(),
  level: z.string().min(2).max(50).optional(),
  timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840).optional(),
  now: z.string().datetime().optional()
});

export const interviewIdParamSchema = z.object({
  id: z.string().cuid()
});
