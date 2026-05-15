import '@ai/prompts/roadmap.prompts.js';
import { BaseAiService } from '@ai/services/base.js';
import { getRoadmapAiModel } from '@config/ai.js';
import { z } from 'zod';

const nonEmptyStringArray = z.array(z.string().min(1)).min(1);

const RoadmapMilestoneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(3),
  description: z.string().min(20),
  durationWeeks: z.number().int().min(1).max(52),
  requiredSkills: nonEmptyStringArray,
  recommendedResources: nonEmptyStringArray,
  projectSuggestions: nonEmptyStringArray,
  successCriteria: nonEmptyStringArray,
  progress: z.number().min(0).max(100),
  status: z.enum(['pending', 'in-progress', 'completed'])
});

const RoadmapSkillSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  currentLevel: z.string().min(1),
  targetLevel: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  progress: z.number().min(0).max(100),
  status: z
    .enum(['not-started', 'learning', 'practicing', 'proficient'])
});

const RoadmapProjectSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(20),
  difficulty: z.string().min(1),
  estimatedWeeks: z.number().int().min(1).max(52),
  technologies: nonEmptyStringArray,
  skillsDemonstrated: nonEmptyStringArray,
  portfolioValue: z.string().min(10)
});

const LearningGoalSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(15),
  resources: nonEmptyStringArray,
  progress: z.number().min(0).max(100),
  status: z.enum(['pending', 'in-progress', 'completed'])
});

const RoadmapTimelinePhaseSchema = z.object({
  title: z.string().min(3),
  durationMonths: z.number().int().min(1).max(24),
  milestones: nonEmptyStringArray
});

const RoadmapTimelineSchema = z.object({
  phases: z.array(RoadmapTimelinePhaseSchema).min(1),
  recommendations: nonEmptyStringArray
});

const RoadmapSchema = z.object({
  title: z.string().min(5),
  targetRole: z.string().min(2),
  currentLevel: z.string().min(2),
  estimatedDurationMonths: z.number().int().min(1).max(36),
  summary: z.string().min(30),
  milestones: z.array(RoadmapMilestoneSchema).min(3).max(6),
  projects: z.array(RoadmapProjectSchema).min(1).max(4),
  skills: z.array(RoadmapSkillSchema).min(3).max(10),
  certifications: z.array(z.string().min(1)),
  learningRecommendations: nonEmptyStringArray,
  learningGoals: z.array(LearningGoalSchema).min(1).max(6),
  timeline: RoadmapTimelineSchema
});

export type RoadmapPayload = z.infer<typeof RoadmapSchema>;

export type RoadmapGenerationContext = {
  targetRole: string;
  currentLevel: string;
  preferredPath: string;
  careerGoals?: string;
  industry?: string;
  resumeText?: string;
  resumeSummary?: string;
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  improvementSuggestions: string[];
  keywordGaps: string[];
  recommendedNextActions: string[];
};

const MAX_ROADMAP_INPUT_TOKENS = 5200;
const ESTIMATED_PROMPT_OVERHEAD_TOKENS = 1100;
const CHARS_PER_TOKEN = 4;

const estimateTokens = (value: string) =>
  Math.ceil(value.replace(/\s+/g, ' ').trim().length / CHARS_PER_TOKEN);

const truncateText = (value: string | undefined, maxChars: number) => {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trim()}...`;
};

const compactList = (items: string[], limit = 8) =>
  items
    .filter(Boolean)
    .map((item) => truncateText(item, 140))
    .slice(0, limit);

const fitRoadmapVariablesToBudget = (variables: Record<string, string>) => {
  const fixedTokens = estimateTokens(
    [
      variables.targetRole,
      variables.currentLevel,
      variables.preferredPath,
      variables.industry,
      variables.strengths,
      variables.weaknesses,
      variables.missingSkills,
      variables.improvementSuggestions,
      variables.keywordGaps,
      variables.recommendedNextActions
    ].join(' ')
  );

  const flexibleBudgetChars = Math.max(
    1200,
    (MAX_ROADMAP_INPUT_TOKENS -
      ESTIMATED_PROMPT_OVERHEAD_TOKENS -
      fixedTokens) *
      CHARS_PER_TOKEN
  );
  const resumeTextChars = Math.max(1200, Math.floor(flexibleBudgetChars * 0.65));
  const resumeSummaryChars = Math.max(400, Math.floor(flexibleBudgetChars * 0.2));
  const careerGoalsChars = Math.max(300, Math.floor(flexibleBudgetChars * 0.15));

  return {
    ...variables,
    careerGoals: truncateText(variables.careerGoals, careerGoalsChars),
    resumeSummary: truncateText(variables.resumeSummary, resumeSummaryChars),
    resumeText: truncateText(variables.resumeText, resumeTextChars)
  };
};

export class RoadmapAiService extends BaseAiService {
  constructor() {
    super(getRoadmapAiModel(), {
      maxRetries: 3,
      timeoutMs: 90000,
      retryDelayMs: 2500,
      unavailableRetryDelayMs: 10000
    });
  }

  async generateCareerRoadmap(
    context: RoadmapGenerationContext
  ): Promise<RoadmapPayload> {
    const variables = fitRoadmapVariablesToBudget({
      targetRole: truncateText(context.targetRole, 120),
      currentLevel: truncateText(context.currentLevel, 80),
      preferredPath: truncateText(context.preferredPath, 160),
      industry: truncateText(context.industry ?? 'not specified', 120),
      careerGoals: truncateText(context.careerGoals ?? 'not specified', 900),
      resumeSummary: truncateText(
        context.resumeSummary ?? 'No resume summary available.',
        1200
      ),
      resumeText: truncateText(context.resumeText, 6000),
      strengths: compactList(context.strengths).join(', ') || 'not available',
      weaknesses: compactList(context.weaknesses).join(', ') || 'not available',
      missingSkills:
        compactList(context.missingSkills).join(', ') || 'not available',
      improvementSuggestions:
        compactList(context.improvementSuggestions).join(', ') || 'not available',
      keywordGaps: compactList(context.keywordGaps).join(', ') || 'not available',
      recommendedNextActions:
        compactList(context.recommendedNextActions).join(', ') || 'not available'
    });
    return this.executePromptWithSchema(
      'career-roadmap-generation',
      variables,
      RoadmapSchema,
      { schemaRetries: 3 }
    );
  }
}
