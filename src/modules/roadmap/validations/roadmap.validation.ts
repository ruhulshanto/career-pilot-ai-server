import { z } from 'zod';
import { ProcessingStatus } from '@prisma/client';

export const createRoadmapSchema = z.object({
  targetRole: z.string().min(2).max(150),
  currentLevel: z.string().min(2).max(100),
  careerGoals: z.string().min(10).max(1000),
  experienceSummary: z.string().min(10).max(1000),
  industry: z.string().min(2).max(100)
});

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
        currentLevel: z.string().min(1).optional(),
        targetLevel: z.string().min(1).optional(),
        progress: z.number().min(0).max(100).optional()
      })
    )
    .optional(),
  timeline: z
    .object({
      phases: z
        .array(
          z.object({
            title: z.string().min(1),
            durationMonths: z.number().min(0),
            milestones: z.array(z.string().min(1))
          })
        )
        .optional(),
      recommendations: z.array(z.string().min(1)).optional()
    })
    .optional()
});

export const getRoadmapsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.nativeEnum(ProcessingStatus).optional(),
  targetRole: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'targetRole']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

export const roadmapIdParamSchema = z.object({
  id: z.string().cuid()
});
