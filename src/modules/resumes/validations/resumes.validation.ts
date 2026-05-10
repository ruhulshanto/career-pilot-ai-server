import { z } from 'zod';
import { ProcessingStatus } from '@prisma/client';

export const submitResumeSchema = z.object({
  title: z.string().min(2).max(150),
  fileUrl: z.string().url(),
  fileType: z.string().min(2).max(50),
  fileSize: z.number().positive().optional()
});

export const getResumesQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  status: z.nativeEnum(ProcessingStatus).optional(),
  search: z.string().min(1).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

export const resumeIdParamSchema = z.object({
  id: z.string().cuid()
});
