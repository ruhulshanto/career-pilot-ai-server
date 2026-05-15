import { z } from 'zod';
import { ProcessingStatus } from '@prisma/client';

export const createRoadmapSchema = z
  .object({
    targetRole: z.string().min(2).max(150),
    currentLevel: z.string().min(2).max(100).optional(),
    experienceLevel: z.string().min(2).max(100).optional(),
    preferredPath: z.string().min(2).max(120).optional(),
    careerGoals: z.string().min(10).max(1000),
    industry: z.string().min(2).max(100).optional(),
    sourceResumeId: z.string().cuid().optional(),
    regenerateFromId: z.string().cuid().optional()
  })
  .refine((value) => value.currentLevel || value.experienceLevel, {
    message: 'Experience level is required',
    path: ['currentLevel']
  })
  .transform((value) => ({
    ...value,
    currentLevel: value.currentLevel ?? value.experienceLevel!,
    preferredPath:
      value.preferredPath ?? `Career growth toward ${value.targetRole}`
  }));

export const updateRoadmapProgressSchema = z.object({
  milestones: z
    .array(
      z.object({
        id: z.string().min(1),
        progress: z.number().min(0).max(100).optional(),
        status: z.enum(['pending', 'in-progress', 'completed']).optional()
      })
    )
    .optional(),
  skills: z
    .array(
      z.object({
        name: z.string().min(1),
        progress: z.number().min(0).max(100).optional(),
        status: z
          .enum(['not-started', 'learning', 'practicing', 'proficient'])
          .optional()
      })
    )
    .optional()
});

export const getRoadmapsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.nativeEnum(ProcessingStatus).optional(),
  targetRole: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'targetRole', 'progress']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

export const roadmapIdParamSchema = z.object({
  id: z.string().cuid()
});
