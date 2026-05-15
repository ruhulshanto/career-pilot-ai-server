import { z } from 'zod';

export const updateApplicationSchema = z.object({
  status: z.enum([
    'SAVED',
    'APPLIED',
    'INTERVIEW_SCHEDULED',
    'OFFER',
    'REJECTED',
    'WITHDRAWN'
  ]),
  notes: z.string().max(1000).optional(),
  interviewAt: z.coerce.date().optional()
});

export const createApplicationSchema = z.object({
  title: z.string().min(2).max(160),
  company: z.string().min(2).max(160),
  location: z.string().max(160).optional(),
  source: z.string().max(80).optional(),
  jobUrl: z.string().url().optional(),
  status: z
    .enum([
      'SAVED',
      'APPLIED',
      'INTERVIEW_SCHEDULED',
      'OFFER',
      'REJECTED',
      'WITHDRAWN'
    ])
    .default('SAVED'),
  notes: z.string().max(1000).optional(),
  appliedAt: z.coerce.date().optional(),
  interviewAt: z.coerce.date().optional()
});

export const analyzeJobDescriptionSchema = z.object({
  jobId: z.string().optional(),
  title: z.string().max(160).optional(),
  company: z.string().max(160).optional(),
  description: z.string().min(20).max(12000)
});

export const createGoalSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().max(1000).optional(),
  targetRole: z.string().max(160).optional(),
  targetDate: z.coerce.date().optional(),
  nextSteps: z.array(z.string().min(2).max(200)).max(8).optional()
});

export const updateGoalSchema = createGoalSchema.partial().extend({
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
  progress: z.coerce.number().min(0).max(100).optional()
});
