import { z } from 'zod';

export const mentorIdParamSchema = z.object({
  id: z.string().cuid()
});

export const requestMentorReviewSchema = z.object({
  type: z.enum(['ROADMAP', 'RESUME', 'INTERVIEW', 'MILESTONE', 'GENERAL']),
  title: z.string().min(2).max(160),
  message: z.string().max(1200).optional(),
  entityType: z.string().max(80).optional(),
  entityId: z.string().max(120).optional()
});

export const updateMentorReviewSchema = z.object({
  status: z
    .enum(['PENDING', 'IN_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'COMPLETED', 'REJECTED'])
    .optional(),
  score: z.number().min(0).max(100).optional(),
  verdict: z.string().max(1600).optional(),
  suggestedEdits: z.unknown().optional()
});

export const addMentorCommentSchema = z.object({
  body: z.string().min(1).max(1600),
  parentId: z.string().cuid().optional(),
  visibility: z.enum(['USER_AND_MENTOR', 'MENTOR_ONLY']).optional()
});

export const requestMentorSessionSchema = z.object({
  topic: z.string().min(2).max(160),
  message: z.string().max(1200).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(120).optional(),
  reviewId: z.string().cuid().optional()
});

export const updateMentorSessionSchema = z.object({
  status: z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED']),
  scheduledAt: z.string().datetime().optional()
});
