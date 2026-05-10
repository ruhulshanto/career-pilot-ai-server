import { BaseAiService } from '@ai/services/base.js';
import type { AiModel } from '@ai/types.js';
import { env } from '@config/env.js';
import { z } from 'zod';
import { logger } from '@/logging/logger.js';

const RoadmapMilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  progress: z.number().min(0).max(100),
  status: z.enum(['pending', 'in-progress', 'completed']),
  recommendation: z.string()
});

const RoadmapSkillSchema = z.object({
  name: z.string(),
  currentLevel: z.string(),
  targetLevel: z.string(),
  progress: z.number().min(0).max(100),
  importance: z.string()
});

const RoadmapTimelinePhaseSchema = z.object({
  title: z.string(),
  durationMonths: z.number().min(0),
  milestones: z.array(z.string())
});

const RoadmapTimelineSchema = z.object({
  phases: z.array(RoadmapTimelinePhaseSchema),
  recommendations: z.array(z.string())
});

const RoadmapSchema = z.object({
  milestones: z.array(RoadmapMilestoneSchema),
  skills: z.array(RoadmapSkillSchema),
  timeline: RoadmapTimelineSchema
});

export type RoadmapMilestonePayload = z.infer<typeof RoadmapMilestoneSchema>;
export type RoadmapSkillPayload = z.infer<typeof RoadmapSkillSchema>;
export type RoadmapTimelinePayload = z.infer<typeof RoadmapTimelineSchema>;
export type RoadmapPayload = z.infer<typeof RoadmapSchema>;

const defaultModel: AiModel = env.OPENAI_API_KEY
  ? { provider: 'openai', model: 'gpt-4', temperature: 0.75 }
  : { provider: 'gemini', model: 'gemini-pro', temperature: 0.75 };

export class RoadmapAiService extends BaseAiService {
  constructor() {
    super(defaultModel);
  }

  async generateCareerRoadmap(
    targetRole: string,
    currentLevel: string,
    careerGoals: string,
    experienceSummary: string,
    industry: string
  ): Promise<RoadmapPayload> {
    try {
      return await this.executePromptWithSchema(
        'career-roadmap-generation',
        {
          targetRole,
          currentLevel,
          careerGoals,
          experienceSummary,
          industry
        },
        RoadmapSchema
      );
    } catch (error) {
      logger.warn(
        { error, targetRole, currentLevel },
        'Roadmap AI fallback activated'
      );
      return this.createFallbackRoadmap(
        targetRole,
        currentLevel,
        careerGoals,
        industry
      );
    }
  }

  private createFallbackRoadmap(
    targetRole: string,
    currentLevel: string,
    careerGoals: string,
    industry: string
  ): RoadmapPayload {
    const milestones = [
      {
        id: 'm1',
        title: 'Define your professional goals',
        description: `Clarify how your experience aligns with ${targetRole} in ${industry}.`,
        progress: 0,
        status: 'pending' as const,
        recommendation:
          'Write down a targeted career goal and ideal role description.'
      },
      {
        id: 'm2',
        title: 'Map your skills to role requirements',
        description: 'Compare your current skills against the target role.',
        progress: 0,
        status: 'pending' as const,
        recommendation:
          'Identify gaps in technical and soft skills required for the role.'
      },
      {
        id: 'm3',
        title: 'Build momentum with a learning plan',
        description: `Create a personalized learning plan for ${industry}.`,
        progress: 0,
        status: 'pending' as const,
        recommendation:
          'Schedule time for skill practice, certification, and project work.'
      }
    ];

    const skills = [
      {
        name: 'Core domain knowledge',
        currentLevel,
        targetLevel: 'Advanced',
        progress: 0,
        importance: 'High'
      },
      {
        name: 'Communication and storytelling',
        currentLevel: 'Intermediate',
        targetLevel: 'Advanced',
        progress: 0,
        importance: 'Medium'
      }
    ];

    const timeline = {
      phases: [
        {
          title: 'Discovery',
          durationMonths: 1,
          milestones: ['m1', 'm2']
        },
        {
          title: 'Development',
          durationMonths: 2,
          milestones: ['m3']
        }
      ],
      recommendations: [
        'Focus on one skill gap at a time.',
        'Track progress weekly and adjust your learning plan.',
        'Practice applying skills through real projects.'
      ]
    };

    return {
      milestones,
      skills,
      timeline
    };
  }
}
