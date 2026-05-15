import { prisma } from '@config/prisma.js';
import {
  AiFeedbackType,
  LearningGoalStatus,
  ProcessingStatus,
  ProjectStatus,
  RoadmapMilestoneStatus as PrismaMilestoneStatus,
  RoadmapSkillStatus as PrismaSkillStatus,
  type Prisma
} from '@prisma/client';
import type {
  GetRoadmapsQuery,
  RoadmapMilestone,
  RoadmapSkill
} from '../types/roadmap.types.js';
import type { RoadmapPayload } from '../services/roadmap-ai.service.js';

const milestoneStatusToPrisma = (status: RoadmapMilestone['status']) => {
  if (status === 'completed') return PrismaMilestoneStatus.COMPLETED;
  if (status === 'in-progress') return PrismaMilestoneStatus.IN_PROGRESS;
  return PrismaMilestoneStatus.PENDING;
};

const milestoneStatusFromPrisma = (status: PrismaMilestoneStatus) => {
  if (status === PrismaMilestoneStatus.COMPLETED) return 'completed';
  if (status === PrismaMilestoneStatus.IN_PROGRESS) return 'in-progress';
  return 'pending';
};

const skillStatusToPrisma = (status: RoadmapSkill['status']) => {
  if (status === 'proficient') return PrismaSkillStatus.PROFICIENT;
  if (status === 'practicing') return PrismaSkillStatus.PRACTICING;
  if (status === 'learning') return PrismaSkillStatus.LEARNING;
  return PrismaSkillStatus.NOT_STARTED;
};

const skillStatusFromPrisma = (status: PrismaSkillStatus) => {
  if (status === PrismaSkillStatus.PROFICIENT) return 'proficient';
  if (status === PrismaSkillStatus.PRACTICING) return 'practicing';
  if (status === PrismaSkillStatus.LEARNING) return 'learning';
  return 'not-started';
};

export const roadmapRepository = {
  createCareerRoadmap(data: {
    userId: string;
    targetRole: string;
    currentLevel: string;
    preferredPath: string;
    sourceResumeId?: string;
    regeneratedFromId?: string;
  }) {
    return prisma.careerRoadmap.create({
      data: {
        userId: data.userId,
        targetRole: data.targetRole,
        currentLevel: data.currentLevel,
        preferredPath: data.preferredPath,
        sourceResumeId: data.sourceResumeId,
        regeneratedFromId: data.regeneratedFromId,
        status: ProcessingStatus.PENDING,
        milestones: [] as Prisma.JsonArray,
        skills: [] as Prisma.JsonArray,
        timeline: { phases: [], recommendations: [] } as Prisma.JsonObject,
        projects: [] as Prisma.JsonArray,
        certifications: [] as Prisma.JsonArray,
        learningRecommendations: [] as Prisma.JsonArray
      }
    });
  },

  async getCareerRoadmaps(userId: string, query: GetRoadmapsQuery = {}) {
    const {
      page = 1,
      limit = 10,
      status,
      targetRole,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query;

    const where: Prisma.CareerRoadmapWhereInput = {
      userId,
      deletedAt: null
    };

    if (status) where.status = status;
    if (targetRole) {
      where.targetRole = { contains: targetRole, mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { targetRole: { contains: search, mode: 'insensitive' } },
        { currentLevel: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [roadmaps, total] = await Promise.all([
      prisma.careerRoadmap.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: this.includeRoadmapRelations(false)
      }),
      prisma.careerRoadmap.count({ where })
    ]);

    return { roadmaps, total, page, limit };
  },

  async getLatestCareerRoadmap(userId: string) {
    return prisma.careerRoadmap.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: this.includeRoadmapRelations(true)
    });
  },

  async getCareerRoadmapById(id: string, userId: string) {
    return prisma.careerRoadmap.findFirst({
      where: { id, userId, deletedAt: null },
      include: this.includeRoadmapRelations(true)
    });
  },

  async getCareerRoadmapForProcessing(id: string, userId: string) {
    return prisma.careerRoadmap.findFirst({
      where: { id, userId, deletedAt: null }
    });
  },

  async getLatestResumeContext(userId: string, sourceResumeId?: string) {
    return prisma.resume.findFirst({
      where: {
        userId,
        deletedAt: null,
        status: ProcessingStatus.COMPLETED,
        ...(sourceResumeId ? { id: sourceResumeId } : {})
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        parsedText: true,
        aiFeedbacks: {
          where: {
            type: AiFeedbackType.RESUME_ANALYSIS,
            status: ProcessingStatus.COMPLETED
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            score: true,
            summary: true,
            strengths: true,
            weaknesses: true,
            suggestions: true,
            rawResponse: true
          }
        }
      }
    });
  },

  async updateRoadmapStatus(
    id: string,
    status: ProcessingStatus,
    failureReason?: string
  ) {
    return prisma.careerRoadmap.update({
      where: { id },
      data: {
        status,
        failureReason,
        updatedAt: new Date()
      }
    });
  },

  async completeGeneratedRoadmap(id: string, data: RoadmapPayload) {
    const progress = calculateRoadmapProgress(data.milestones, data.skills);

    await prisma.$transaction(async (tx) => {
      await tx.roadmapMilestone.deleteMany({ where: { roadmapId: id } });
      await tx.roadmapSkill.deleteMany({ where: { roadmapId: id } });
      await tx.roadmapProject.deleteMany({ where: { roadmapId: id } });
      await tx.learningGoal.deleteMany({ where: { roadmapId: id } });

      await tx.careerRoadmap.update({
        where: { id },
        data: {
          title: data.title,
          targetRole: data.targetRole,
          currentLevel: data.currentLevel,
          estimatedDurationMonths: data.estimatedDurationMonths,
          summary: data.summary,
          progress,
          status: ProcessingStatus.COMPLETED,
          milestones: data.milestones as unknown as Prisma.InputJsonValue,
          skills: data.skills as unknown as Prisma.InputJsonValue,
          timeline: data.timeline as unknown as Prisma.InputJsonValue,
          projects: data.projects as unknown as Prisma.InputJsonValue,
          certifications:
            data.certifications as unknown as Prisma.InputJsonValue,
          learningRecommendations:
            data.learningRecommendations as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
          failureReason: null
        }
      });

      await tx.roadmapMilestone.createMany({
        data: data.milestones.map((milestone, index) => ({
          roadmapId: id,
          sequence: index + 1,
          title: milestone.title,
          description: milestone.description,
          durationWeeks: milestone.durationWeeks,
          status: milestoneStatusToPrisma(milestone.status),
          progress: milestone.progress,
          requiredSkills:
            milestone.requiredSkills as unknown as Prisma.InputJsonValue,
          resources:
            milestone.recommendedResources as unknown as Prisma.InputJsonValue,
          projectIdeas:
            milestone.projectSuggestions as unknown as Prisma.InputJsonValue,
          successCriteria:
            milestone.successCriteria as unknown as Prisma.InputJsonValue
        }))
      });

      await tx.roadmapSkill.createMany({
        data: uniqueBy(data.skills, (skill) => skill.name.toLowerCase()).map(
          (skill) => ({
            roadmapId: id,
            name: skill.name,
            category: skill.category,
            currentLevel: skill.currentLevel,
            targetLevel: skill.targetLevel,
            priority: skill.priority,
            progress: skill.progress,
            status: skillStatusToPrisma(skill.status)
          })
        )
      });

      await tx.roadmapProject.createMany({
        data: data.projects.map((project) => ({
          roadmapId: id,
          title: project.title,
          description: project.description,
          difficulty: project.difficulty,
          estimatedWeeks: project.estimatedWeeks,
          technologies:
            project.technologies as unknown as Prisma.InputJsonValue,
          skillsDemonstrated:
            project.skillsDemonstrated as unknown as Prisma.InputJsonValue,
          portfolioValue: project.portfolioValue,
          status: ProjectStatus.PLANNED
        }))
      });

      await tx.learningGoal.createMany({
        data: data.learningGoals.map((goal) => ({
          roadmapId: id,
          title: goal.title,
          description: goal.description,
          resources: goal.resources as unknown as Prisma.InputJsonValue,
          progress: goal.progress,
          status:
            goal.status === 'completed'
              ? LearningGoalStatus.COMPLETED
              : goal.status === 'in-progress'
                ? LearningGoalStatus.IN_PROGRESS
                : LearningGoalStatus.PENDING
        }))
      });
    }, {
      maxWait: 20000,
      timeout: 60000
    });

    return prisma.careerRoadmap.findUniqueOrThrow({
      where: { id },
      include: this.includeRoadmapRelations(true)
    });
  },

  async updateCareerRoadmapProgress(
    id: string,
    data: {
      milestones?: Array<{
        id: string;
        progress?: number;
        status?: RoadmapMilestone['status'];
      }>;
      skills?: Array<{
        name: string;
        progress?: number;
        status?: RoadmapSkill['status'];
      }>;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      for (const milestone of data.milestones ?? []) {
        await tx.roadmapMilestone.updateMany({
          where: { roadmapId: id, OR: [{ id: milestone.id }, { title: milestone.id }] },
          data: {
            ...(milestone.progress !== undefined
              ? { progress: milestone.progress }
              : {}),
            ...(milestone.status
              ? {
                  status: milestoneStatusToPrisma(milestone.status),
                  completedAt:
                    milestone.status === 'completed' ? new Date() : null
                }
              : {})
          }
        });
      }

      for (const skill of data.skills ?? []) {
        await tx.roadmapSkill.updateMany({
          where: { roadmapId: id, name: skill.name },
          data: {
            ...(skill.progress !== undefined ? { progress: skill.progress } : {}),
            ...(skill.status ? { status: skillStatusToPrisma(skill.status) } : {})
          }
        });
      }

      const [milestones, skills] = await Promise.all([
        tx.roadmapMilestone.findMany({
          where: { roadmapId: id },
          orderBy: { sequence: 'asc' }
        }),
        tx.roadmapSkill.findMany({
          where: { roadmapId: id },
          orderBy: { name: 'asc' }
        })
      ]);

      const milestoneSnapshot = milestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        description: milestone.description,
        durationWeeks: milestone.durationWeeks ?? 0,
        requiredSkills: arrayFromJson(milestone.requiredSkills),
        recommendedResources: arrayFromJson(milestone.resources),
        projectSuggestions: arrayFromJson(milestone.projectIdeas),
        successCriteria: arrayFromJson(milestone.successCriteria),
        progress: milestone.progress,
        status: milestoneStatusFromPrisma(milestone.status)
      }));

      const skillSnapshot = skills.map((skill) => ({
        name: skill.name,
        category: skill.category ?? 'General',
        currentLevel: skill.currentLevel ?? 'Unknown',
        targetLevel: skill.targetLevel,
        priority: skill.priority as RoadmapSkill['priority'],
        progress: skill.progress,
        status: skillStatusFromPrisma(skill.status)
      }));

      const progress = calculateRoadmapProgress(milestoneSnapshot, skillSnapshot);

      return tx.careerRoadmap.update({
        where: { id },
        data: {
          milestones: milestoneSnapshot as unknown as Prisma.InputJsonValue,
          skills: skillSnapshot as unknown as Prisma.InputJsonValue,
          progress,
          completedAt: progress >= 100 ? new Date() : null
        },
        include: this.includeRoadmapRelations(true)
      });
    });
  },

  createRoadmapAiFeedback(data: {
    userId: string;
    careerRoadmapId: string;
    provider: string;
    status: ProcessingStatus;
    score?: number;
    summary?: string;
    strengths?: string[];
    weaknesses?: string[];
    suggestions?: string[];
    promptTokens?: number;
    completionTokens?: number;
    rawResponse?: unknown;
    errorMessage?: string;
  }) {
    return prisma.aiFeedback.create({
      data: {
        userId: data.userId,
        resumeId: null,
        interviewSessionId: null,
        careerRoadmapId: data.careerRoadmapId,
        chatbotSessionId: null,
        type: AiFeedbackType.ROADMAP_GENERATION,
        provider: data.provider as any,
        status: data.status,
        score: data.score,
        summary: data.summary,
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        suggestions: data.suggestions,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        rawResponse: data.rawResponse as unknown as Prisma.InputJsonValue,
        errorMessage: data.errorMessage
      }
    });
  },

  includeRoadmapRelations(includeFeedbacks: boolean) {
    return {
      milestoneRecords: { orderBy: { sequence: 'asc' as const } },
      skillRecords: { orderBy: { name: 'asc' as const } },
      projectRecords: { orderBy: { createdAt: 'asc' as const } },
      learningGoals: { orderBy: { createdAt: 'asc' as const } },
      aiFeedbacks: includeFeedbacks
        ? {
            select: {
              id: true,
              type: true,
              provider: true,
              status: true,
              score: true,
              summary: true,
              strengths: true,
              weaknesses: true,
              suggestions: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' as const }
          }
        : false
    };
  }
};

const arrayFromJson = (value: Prisma.JsonValue | null): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const calculateRoadmapProgress = (
  milestones: Array<{ progress: number }>,
  skills: Array<{ progress: number }>
) => Math.round(average([...milestones, ...skills].map((item) => item.progress)));

const uniqueBy = <T>(items: T[], getKey: (item: T) => string) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
