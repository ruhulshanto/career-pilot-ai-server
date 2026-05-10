import { addJobWithContext, getAnalyticsQueue } from '@queues/index.js';
import { roadmapRepository } from '@modules/roadmap/repositories/roadmap.repository.js';
import { createPaginationMeta } from '@shared/helpers/pagination.js';
import { ApiError } from '@shared/errors/api-error.js';
import { ProcessingStatus } from '@prisma/client';
import { RoadmapAiService } from './roadmap-ai.service.js';
import type {
  CreateRoadmapRequest,
  GetRoadmapsQuery,
  RoadmapMilestone,
  RoadmapResponse,
  RoadmapSkill,
  RoadmapTimeline,
  UpdateRoadmapProgressRequest
} from '../types/roadmap.types.js';

const aiService = new RoadmapAiService();

const mapRoadmap = (roadmap: any): RoadmapResponse => ({
  id: roadmap.id,
  userId: roadmap.userId,
  targetRole: roadmap.targetRole,
  currentLevel: roadmap.currentLevel,
  status: roadmap.status,
  milestones: (roadmap.milestones ?? []) as any,
  skills: (roadmap.skills ?? []) as any,
  timeline: (roadmap.timeline ?? { phases: [], recommendations: [] }) as any,
  createdAt: roadmap.createdAt,
  updatedAt: roadmap.updatedAt,
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

const mergeMilestones = (
  existing: any[],
  updates: UpdateRoadmapProgressRequest['milestones']
) =>
  existing.map((milestone) => {
    const update = updates?.find((item) => item.id === milestone.id);
    return update ? { ...milestone, ...update } : milestone;
  });

const mergeSkills = (
  existing: any[],
  updates: UpdateRoadmapProgressRequest['skills']
) =>
  existing.map((skill) => {
    const update = updates?.find((item) => item.name === skill.name);
    return update ? { ...skill, ...update } : skill;
  });

export const roadmapService = {
  async generateRoadmap(userId: string, payload: CreateRoadmapRequest) {
    const roadmap = await roadmapRepository.createCareerRoadmap({
      userId,
      targetRole: payload.targetRole,
      currentLevel: payload.currentLevel,
      careerGoals: payload.careerGoals,
      experienceSummary: payload.experienceSummary,
      industry: payload.industry
    });

    await addJobWithContext('ai-processing', 'generate-career-roadmap', {
      task: 'generate-career-roadmap',
      data: {
        roadmapId: roadmap.id,
        userId,
        targetRole: payload.targetRole,
        currentLevel: payload.currentLevel,
        careerGoals: payload.careerGoals,
        experienceSummary: payload.experienceSummary,
        industry: payload.industry
      }
    });

    await getAnalyticsQueue().add('analytics-job', {
      event: 'career_roadmap_created',
      data: {
        userId,
        careerRoadmapId: roadmap.id,
        targetRole: payload.targetRole
      }
    });

    return mapRoadmap({
      ...roadmap,
      milestones: [],
      skills: [],
      timeline: { phases: [], recommendations: [] },
      aiFeedbacks: []
    });
  },

  async getRoadmaps(userId: string, query: GetRoadmapsQuery = {}) {
    const { roadmaps, total, page, limit } =
      await roadmapRepository.getCareerRoadmaps(userId, query);

    return {
      data: roadmaps.map((roadmap) =>
        mapRoadmap({ ...roadmap, aiFeedbacks: [] })
      ),
      pagination: createPaginationMeta(total, page, limit)
    };
  },

  async getRoadmapById(userId: string, id: string) {
    const roadmap = await roadmapRepository.getCareerRoadmapById(id, userId);
    if (!roadmap) {
      return null;
    }

    return mapRoadmap(roadmap);
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

    const existingMilestones = (roadmap.milestones ?? []) as RoadmapMilestone[];
    const existingSkills = (roadmap.skills ?? []) as RoadmapSkill[];
    const existingTimeline = (roadmap.timeline ?? {
      phases: [],
      recommendations: []
    }) as RoadmapTimeline;

    const updatedMilestones = payload.milestones
      ? mergeMilestones(existingMilestones, payload.milestones)
      : existingMilestones;

    const updatedSkills = payload.skills
      ? mergeSkills(existingSkills, payload.skills)
      : existingSkills;

    const updatedTimeline = payload.timeline ?? existingTimeline;

    const updated = await roadmapRepository.updateCareerRoadmap(id, {
      milestones: updatedMilestones,
      skills: updatedSkills,
      timeline: updatedTimeline,
      status: roadmap.status
    });

    await getAnalyticsQueue().add('analytics-job', {
      event: 'career_roadmap_progress_updated',
      data: {
        userId,
        careerRoadmapId: id,
        milestoneUpdates: payload.milestones?.length ?? 0,
        skillUpdates: payload.skills?.length ?? 0
      }
    });

    return mapRoadmap({ ...updated, aiFeedbacks: roadmap.aiFeedbacks ?? [] });
  }
};
