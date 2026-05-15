import { addJobWithContext, createSafeJobId, getAnalyticsQueue } from '@queues/index.js';
import {
  AI_QUOTA_EXCEEDED_MESSAGE,
  getAiProviderQuotaBlockedUntil,
  isAiProviderQuotaBlocked
} from '@ai/clients/ai-client.js';
import { isGroqConfigured } from '@config/ai.js';
import { env } from '@config/env.js';
import { dashboardCacheService } from '@modules/dashboard/services/dashboard-cache.service.js';
import { roadmapRepository } from '@modules/roadmap/repositories/roadmap.repository.js';
import { createPaginationMeta } from '@shared/helpers/pagination.js';
import { ApiError } from '@shared/errors/api-error.js';
import { ProcessingStatus } from '@prisma/client';
import type {
  CreateRoadmapRequest,
  GetRoadmapsQuery,
  RoadmapMilestone,
  RoadmapProject,
  RoadmapResponse,
  RoadmapSkill,
  RoadmapTimeline,
  UpdateRoadmapProgressRequest
} from '../types/roadmap.types.js';

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const roadmapRetryPattern =
  /\[retry:availableAt=(?<availableAt>[^;\]]+);attempt=(?<attempt>\d+);limit=(?<limit>\d+)\]/;
const ROADMAP_AI_RETRY_LIMIT = 3;

const buildRoadmapRetryMessage = (
  message: string,
  retryAfterMs: number,
  retryAttempt: number
) => {
  const retryAvailableAt = new Date(Date.now() + retryAfterMs);
  return `${message} CareerAI will retry automatically at ${retryAvailableAt.toLocaleString()}. [retry:availableAt=${retryAvailableAt.toISOString()};attempt=${retryAttempt};limit=${ROADMAP_AI_RETRY_LIMIT}]`;
};

const getRoadmapRetryMetadata = (
  failureReason?: string | null,
  status?: ProcessingStatus
) => {
  const match = failureReason?.match(roadmapRetryPattern);
  if (!match?.groups) {
    return {};
  }

  const retryAvailableAt = new Date(match.groups.availableAt);
  const retryAttempt = Number(match.groups.attempt);
  const retryLimit = Number(match.groups.limit);
  const retryAfterMs = Number.isNaN(retryAvailableAt.getTime())
    ? undefined
    : Math.max(0, retryAvailableAt.getTime() - Date.now());

  return {
    retryAfterMs,
    retryAvailableAt: Number.isNaN(retryAvailableAt.getTime())
      ? undefined
      : retryAvailableAt,
    retryAttempt: Number.isFinite(retryAttempt) ? retryAttempt : undefined,
    retryLimit: Number.isFinite(retryLimit) ? retryLimit : undefined,
    retryLimitReached:
      status === ProcessingStatus.FAILED &&
      Number.isFinite(retryAttempt) &&
      Number.isFinite(retryLimit) &&
      retryAttempt >= retryLimit
  };
};

const mapRoadmap = (roadmap: any): RoadmapResponse => ({
  id: roadmap.id,
  userId: roadmap.userId,
  title: roadmap.title ?? undefined,
  targetRole: roadmap.targetRole,
  currentLevel: roadmap.currentLevel,
  preferredPath: roadmap.preferredPath ?? undefined,
  estimatedDurationMonths: roadmap.estimatedDurationMonths ?? undefined,
  summary: roadmap.summary ?? undefined,
  progress: Math.round(roadmap.progress ?? 0),
  version: roadmap.version ?? 1,
  sourceResumeId: roadmap.sourceResumeId ?? undefined,
  regeneratedFromId: roadmap.regeneratedFromId ?? undefined,
  status: roadmap.status,
  milestones: asArray<RoadmapMilestone>(roadmap.milestones),
  skills: asArray<RoadmapSkill>(roadmap.skills),
  projects: asArray<RoadmapProject>(roadmap.projects),
  certifications: asArray<string>(roadmap.certifications),
  learningRecommendations: asArray<string>(roadmap.learningRecommendations),
  timeline: (roadmap.timeline ?? { phases: [], recommendations: [] }) as RoadmapTimeline,
  failureReason: roadmap.failureReason ?? undefined,
  ...getRoadmapRetryMetadata(roadmap.failureReason, roadmap.status),
  createdAt: roadmap.createdAt,
  updatedAt: roadmap.updatedAt,
  completedAt: roadmap.completedAt ?? undefined,
  aiFeedbacks: (roadmap.aiFeedbacks ?? []).map((feedback: any) => ({
    id: feedback.id,
    type: feedback.type,
    provider: feedback.provider,
    status: feedback.status,
    score: feedback.score ?? undefined,
    summary: feedback.summary ?? undefined,
    strengths: feedback.strengths,
    weaknesses: feedback.weaknesses,
    suggestions: feedback.suggestions,
    createdAt: feedback.createdAt
  }))
});

export const roadmapService = {
  async generateRoadmap(userId: string, payload: CreateRoadmapRequest) {
    const aiProvider = env.AI_PROVIDER;
    if (!isGroqConfigured()) {
      throw new ApiError(
        503,
        'AI roadmap generation is not configured yet. Add GROQ_API_KEY to the backend .env and restart the server.',
        {
          code: 'GROQ_API_KEY_MISSING'
        }
      );
    }

    if (payload.regenerateFromId) {
      const existing = await roadmapRepository.getCareerRoadmapById(
        payload.regenerateFromId,
        userId
      );
      if (!existing) {
        throw new ApiError(404, 'Source roadmap for regeneration was not found');
      }
    }

    if (payload.sourceResumeId) {
      const resumeContext = await roadmapRepository.getLatestResumeContext(
        userId,
        payload.sourceResumeId
      );
      if (!resumeContext) {
        throw new ApiError(
          400,
          'Selected resume must exist and have completed AI analysis before roadmap generation'
        );
      }
    }

    const roadmap = await roadmapRepository.createCareerRoadmap({
      userId,
      targetRole: payload.targetRole,
      currentLevel: payload.currentLevel,
      preferredPath: payload.preferredPath,
      sourceResumeId: payload.sourceResumeId,
      regeneratedFromId: payload.regenerateFromId
    });

    const jobPayload = {
      task: 'generate-career-roadmap',
      data: {
        roadmapId: roadmap.id,
        userId,
        targetRole: payload.targetRole,
        currentLevel: payload.currentLevel,
        preferredPath: payload.preferredPath,
        careerGoals: payload.careerGoals,
        industry: payload.industry,
        sourceResumeId: payload.sourceResumeId
      }
    };
    const roadmapJobId = createSafeJobId('roadmap', 'generate', roadmap.id);

    if (isAiProviderQuotaBlocked(aiProvider)) {
      const blockedUntil = getAiProviderQuotaBlockedUntil(aiProvider);
      const retryAfterMs = blockedUntil
        ? Math.max(0, blockedUntil - Date.now())
        : 10 * 60 * 1000;

      const queued = await roadmapRepository.updateRoadmapStatus(
        roadmap.id,
        ProcessingStatus.PENDING,
        buildRoadmapRetryMessage(AI_QUOTA_EXCEEDED_MESSAGE, retryAfterMs, 1)
      );

      await addJobWithContext(
        'ai-processing',
        'generate-career-roadmap',
        jobPayload,
        {
          jobId: roadmapJobId,
          delay: retryAfterMs,
          attempts: 1
        }
      );

      return mapRoadmap(queued);
    }

    await addJobWithContext('ai-processing', 'generate-career-roadmap', jobPayload, {
      jobId: roadmapJobId,
      attempts: 1
    });

    await getAnalyticsQueue().add('analytics-job', {
      event: 'career_roadmap_created',
      data: {
        userId,
        careerRoadmapId: roadmap.id,
        targetRole: payload.targetRole
      }
    });
    await dashboardCacheService.invalidate(userId);

    return mapRoadmap(roadmap);
  },

  async getRoadmaps(userId: string, query: GetRoadmapsQuery = {}) {
    const { roadmaps, total, page, limit } =
      await roadmapRepository.getCareerRoadmaps(userId, query);

    return {
      data: roadmaps.map(mapRoadmap),
      pagination: createPaginationMeta(page, limit, total)
    };
  },

  async getLatestRoadmap(userId: string) {
    const roadmap = await roadmapRepository.getLatestCareerRoadmap(userId);
    return roadmap ? mapRoadmap(roadmap) : null;
  },

  async getRoadmapById(userId: string, id: string) {
    const roadmap = await roadmapRepository.getCareerRoadmapById(id, userId);
    return roadmap ? mapRoadmap(roadmap) : null;
  },

  async updateRoadmapProgress(
    userId: string,
    id: string,
    payload: UpdateRoadmapProgressRequest
  ) {
    const roadmap = await roadmapRepository.getCareerRoadmapById(id, userId);
    if (!roadmap) {
      throw new ApiError(404, 'Career roadmap not found');
    }

    const updated = await roadmapRepository.updateCareerRoadmapProgress(
      id,
      payload
    );

    await getAnalyticsQueue().add('analytics-job', {
      event: 'career_roadmap_progress_updated',
      data: {
        userId,
        careerRoadmapId: id,
        milestoneUpdates: payload.milestones?.length ?? 0,
        skillUpdates: payload.skills?.length ?? 0,
        progress: updated.progress
      }
    });
    await dashboardCacheService.invalidate(userId);

    return mapRoadmap(updated);
  }
};
