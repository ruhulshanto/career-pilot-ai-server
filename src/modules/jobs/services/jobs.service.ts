import { randomUUID } from 'node:crypto';
import { dashboardCacheService } from '@modules/dashboard/services/dashboard-cache.service.js';
import { notificationsService } from '@modules/notifications/services/notifications.service.js';
import { ApiError } from '@shared/errors/api-error.js';
import { jobsRepository } from '../repositories/jobs.repository.js';
import type {
  CareerGoalResponse,
  JobApplicationResponse,
  JobFitAnalysisResponse,
  JobMatchResponse
} from '../types/jobs.types.js';
import { analyzeJobFitSignals } from './job-fit-calculations.js';
import { buildLinkedInSearchAssistantUrl } from './job-search-url.js';

const searchLeadBlueprints = [
  {
    label: 'Focused LinkedIn search',
    source: 'LINKEDIN_SEARCH_ASSISTANT',
    sourceLabel: 'LinkedIn Search Assistant',
    titleFor: (targetRole: string) => `${targetRole} roles on LinkedIn`,
    location: 'External search',
    skills: ['React', 'TypeScript', 'Testing']
  },
  {
    label: 'Full-stack job board search',
    source: 'EXTERNAL_SEARCH_ASSISTANT',
    sourceLabel: 'External Job Search',
    titleFor: (targetRole: string) => `${targetRole} roles with full-stack scope`,
    location: 'Remote or hybrid',
    skills: ['Node.js', 'React', 'SQL']
  },
  {
    label: 'Backend platform search',
    source: 'EXTERNAL_SEARCH_ASSISTANT',
    sourceLabel: 'External Job Search',
    titleFor: (targetRole: string) => `${targetRole} backend/platform variants`,
    location: 'Remote or hybrid',
    skills: ['Node.js', 'PostgreSQL', 'APIs']
  },
  {
    label: 'Software engineering search',
    source: 'EXTERNAL_SEARCH_ASSISTANT',
    sourceLabel: 'External Job Search',
    titleFor: (targetRole: string) => `${targetRole} software engineering variants`,
    location: 'External search',
    skills: ['JavaScript', 'System Design', 'Communication']
  },
  {
    label: 'AI product engineering search',
    source: 'EXTERNAL_SEARCH_ASSISTANT',
    sourceLabel: 'External Job Search',
    titleFor: (targetRole: string) => `${targetRole} AI/product variants`,
    location: 'External search',
    skills: ['LLM', 'APIs', 'TypeScript']
  }
];

const MATCHER_VERSION = 2;

const textArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'name' in item) {
          return String((item as { name?: unknown }).name ?? '');
        }
        return '';
      })
      .filter(Boolean);
  }
  return [];
};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const uniqueText = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const roleTokens = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/i)
    .filter(
      (token) =>
        token.length > 2 &&
        !['junior', 'senior', 'lead', 'role'].includes(token)
    );

const hasSkillSignal = (haystack: Set<string>, skill: string) => {
  const normalizedSkill = skill.toLowerCase();
  if (haystack.has(normalizedSkill)) return true;
  return Array.from(haystack).some(
    (item) => item.includes(normalizedSkill) || normalizedSkill.includes(item)
  );
};

const buildMatcherContext = async (userId: string) => {
  const [signals, resumeSignals, interviewSignals] = await Promise.all([
    jobsRepository.getLatestCareerSignals(userId),
    jobsRepository.getLatestResumeSignals(userId),
    jobsRepository.getInterviewScoreSignal(userId)
  ]);
  const resumeRaw = (resumeSignals?.rawResponse ?? {}) as Record<
    string,
    unknown
  >;
  const roadmapRole = firstText(signals?.targetRole);
  const targetRole =
    firstText(signals?.targetRole, resumeRaw.inferredTargetRole) ??
    'Software Developer';
  const experienceLevel =
    firstText(signals?.currentLevel, resumeRaw.experienceLevel) ?? 'General';
  const skills = uniqueText([
    ...textArray(signals?.skills),
    ...(signals?.skillRecords.map((skill) => skill.name) ?? []),
    ...textArray(resumeRaw.skills),
    ...textArray(resumeRaw.technicalSkills),
    ...textArray(resumeRaw.strengths),
    ...textArray(resumeSignals?.strengths)
  ]);
  const resumeGaps = uniqueText([
    ...textArray(resumeRaw.missingSkills),
    ...textArray(resumeRaw.keywordGaps),
    ...textArray(resumeSignals?.weaknesses)
  ]);
  const matcherContextKey = [
    targetRole,
    experienceLevel,
    ...skills.slice().sort(),
    ...resumeGaps.slice().sort()
  ]
    .join('|')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  return {
    targetRole,
    roadmapRole,
    experienceLevel,
    skills,
    resumeGaps,
    resumeScore: Math.round(resumeSignals?.score ?? 0),
    interviewAverage: Math.round(interviewSignals._avg.score ?? 0),
    completedInterviewCount: interviewSignals._count._all,
    matcherContextKey
  };
};

const buildMatchedJobs = async (userId: string) => {
  const {
    targetRole,
    roadmapRole,
    experienceLevel,
    skills,
    resumeGaps,
    resumeScore,
    interviewAverage,
    completedInterviewCount,
    matcherContextKey
  } = await buildMatcherContext(userId);
  const normalizedSkills = new Set(skills.map((skill) => skill.toLowerCase()));
  const targetTokens = roleTokens(targetRole);

  return searchLeadBlueprints.map((job, index) => {
    const displayTitle = job.titleFor(targetRole.replace(/\s+/g, ' '));
    const overlap = roleTokens(displayTitle).filter((token) =>
      targetTokens.includes(token)
    ).length;
    const roleBoost = Math.min(18, overlap * 6);
    const gapBoost = job.skills.some((skill) =>
      resumeGaps.some((gap) => gap.toLowerCase().includes(skill.toLowerCase()))
    )
      ? 6
      : 0;
    const matches = job.skills.filter((skill) =>
      hasSkillSignal(normalizedSkills, skill)
    );
    const matchScore = Math.min(
      96,
      58 + roleBoost + gapBoost + matches.length * 10
    );
    const missingSkills = Array.from(
      new Set([
        ...job.skills.filter((skill) => !matches.includes(skill)),
        ...resumeGaps.slice(0, 3)
      ])
    ).slice(0, 5);

    return {
      source: job.source,
      externalId: `${userId}-${targetRole}-${experienceLevel}-${index}`.replace(
        /[^a-zA-Z0-9_-]/g,
        '-'
      ),
      title: displayTitle,
      company: job.sourceLabel,
      location: job.location,
      jobUrl: buildLinkedInSearchAssistantUrl({
        recommendationTitle: displayTitle,
        targetRole,
        roadmapRole,
        careerLevel: experienceLevel,
        matchedSkills: matches,
        missingSkills
      }),
      matchScore,
      skillsMatch: matches,
      metadata: {
        matcherVersion: MATCHER_VERSION,
        matcherContextKey,
        targetRole,
        roadmapRole,
        experienceLevel,
        sourceLabel: job.sourceLabel,
        isSearchAssistant: true,
        missingSkills,
        matchReasons: [
          `Search keywords were built from your ${experienceLevel} profile and target role.`,
          `${matches.length} current skill signal${matches.length === 1 ? '' : 's'} matched this lead.`,
          completedInterviewCount > 0
            ? `Interview performance signal (${interviewAverage}%) was considered.`
            : 'No interview practice signal is available yet.'
        ],
        recommendedImprovements: missingSkills.slice(0, 3).map((skill) =>
          `Improve or evidence ${skill} before applying to similar roles.`
        ),
        reason:
          'This is a search assistant lead, not a scraped job posting or unofficial LinkedIn integration.'
      }
    };
  });
};

const mapRecommendation = (job: any): JobMatchResponse => {
  const metadata = (job.metadata ?? {}) as {
    targetRole?: unknown;
    roadmapRole?: unknown;
    experienceLevel?: unknown;
    missingSkills?: unknown;
    matchReasons?: unknown;
    recommendedImprovements?: unknown;
    sourceLabel?: unknown;
    isSearchAssistant?: unknown;
  };
  const skillsMatch = textArray(job.skillsMatch);
  const missingSkills = textArray(metadata.missingSkills);
  const sourceLabel = firstText(metadata.sourceLabel) ?? sourceLabelFor(job.source);

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location ?? undefined,
    jobUrl: buildLinkedInSearchAssistantUrl({
      recommendationTitle: job.title,
      targetRole: firstText(metadata.targetRole),
      roadmapRole: firstText(metadata.roadmapRole),
      careerLevel: firstText(metadata.experienceLevel),
      matchedSkills: skillsMatch,
      missingSkills
    }),
    matchScore: Math.round(job.matchScore),
    skillsMatch,
    missingSkills,
    matchReasons: textArray(metadata.matchReasons),
    recommendedImprovements: textArray(metadata.recommendedImprovements),
    source: job.source,
    sourceLabel,
    isSearchAssistant: metadata.isSearchAssistant === true,
    applicationStatus: job.applications?.[0]?.status,
    createdAt: job.createdAt.toISOString()
  };
};

const sourceLabelFor = (source: string) => {
  if (source === 'LINKEDIN_SEARCH_ASSISTANT') return 'LinkedIn Search Assistant';
  if (source === 'MANUAL_TRACKED') return 'Manual Tracker';
  if (source === 'EXTERNAL_SEARCH_ASSISTANT') return 'External Job Search';
  return source
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const mapApplication = (application: any): JobApplicationResponse => {
  const metadata = (application.jobRecommendation.metadata ?? {}) as {
    missingSkills?: unknown;
    sourceLabel?: unknown;
  };

  return {
    id: application.id,
    jobId: application.jobRecommendationId,
    title: application.jobRecommendation.title,
    company: application.jobRecommendation.company,
    location: application.jobRecommendation.location ?? undefined,
    source: application.jobRecommendation.source,
    sourceLabel:
      firstText(metadata.sourceLabel) ??
      sourceLabelFor(application.jobRecommendation.source),
    jobUrl: application.jobRecommendation.jobUrl ?? undefined,
    matchScore: Math.round(application.jobRecommendation.matchScore ?? 0),
    skillsMatch: textArray(application.jobRecommendation.skillsMatch),
    missingSkills: textArray(metadata.missingSkills),
    status: application.status,
    notes: application.notes ?? undefined,
    appliedAt: application.appliedAt?.toISOString(),
    interviewAt: application.interviewAt?.toISOString(),
    updatedAt: application.updatedAt.toISOString()
  };
};

const mapGoal = (goal: any): CareerGoalResponse => ({
  id: goal.id,
  title: goal.title,
  description: goal.description ?? undefined,
  targetRole: goal.targetRole ?? undefined,
  targetDate: goal.targetDate?.toISOString(),
  status: goal.status,
  progress: Math.round(goal.progress),
  nextSteps: textArray(goal.nextSteps),
  updatedAt: goal.updatedAt.toISOString()
});

export const jobsService = {
  async refreshRecommendations(userId: string): Promise<JobMatchResponse[]> {
    const jobs = await buildMatchedJobs(userId);
    await jobsRepository.upsertRecommendations(userId, jobs as any);
    await dashboardCacheService.invalidate(userId);
    const recommendations = await jobsRepository.getRecommendations(userId);
    await notificationsService.notifyJobMatches(userId, recommendations.slice(0, 3));
    return recommendations.map(mapRecommendation);
  },

  async getRecommendations(userId: string): Promise<JobMatchResponse[]> {
    const existing = await jobsRepository.getRecommendations(userId);
    const { matcherContextKey } = await buildMatcherContext(userId);
    const hasStaleMatches = existing.some((job: any) => {
      const metadata = job.metadata as {
        matcherVersion?: number;
        matcherContextKey?: string;
      } | null;
      return (
        metadata?.matcherVersion !== MATCHER_VERSION ||
        metadata?.matcherContextKey !== matcherContextKey
      );
    });
    if (hasStaleMatches) return this.refreshRecommendations(userId);
    if (existing.length > 0) return existing.map(mapRecommendation);
    return this.refreshRecommendations(userId);
  },

  async saveJobLead(
    userId: string,
    jobId: string
  ): Promise<JobApplicationResponse[]> {
    const job = await jobsRepository.getRecommendationById(userId, jobId);
    if (!job) {
      throw new ApiError(404, 'Job recommendation not found');
    }

    await jobsRepository.saveJobLead(userId, jobId);
    await dashboardCacheService.invalidate(userId);
    return this.getApplications(userId);
  },

  async applyToJob(
    userId: string,
    jobId: string
  ): Promise<JobApplicationResponse[]> {
    return this.saveJobLead(userId, jobId);
  },

  async createApplication(
    userId: string,
    data: any
  ): Promise<JobApplicationResponse> {
    const status = data.status ?? 'SAVED';
    const application = await jobsRepository.createTrackedApplication(userId, {
      externalId: `manual-${userId}-${randomUUID()}`,
      title: data.title,
      company: data.company,
      location: data.location,
      source: 'MANUAL_TRACKED',
      sourceLabel: data.source?.trim() || 'Manual Tracker',
      jobUrl: data.jobUrl,
      status,
      notes: data.notes,
      appliedAt:
        data.appliedAt ?? (status === 'APPLIED' ? new Date() : undefined),
      interviewAt: data.interviewAt
    });
    await dashboardCacheService.invalidate(userId);
    return mapApplication(application);
  },

  async getApplications(userId: string): Promise<JobApplicationResponse[]> {
    return (await jobsRepository.getApplications(userId)).map(mapApplication);
  },

  async updateApplication(
    userId: string,
    id: string,
    data: any
  ): Promise<JobApplicationResponse> {
    const existing = await jobsRepository.getApplicationById(userId, id);
    if (!existing) {
      throw new ApiError(404, 'Job application not found');
    }

    const updateData = {
      ...data,
      appliedAt:
        data.status === 'APPLIED' && !existing.appliedAt
          ? new Date()
          : data.appliedAt,
      interviewAt:
        data.status === 'INTERVIEW_SCHEDULED'
          ? data.interviewAt
          : data.interviewAt
    };
    const application = await jobsRepository.updateApplication(userId, id, updateData);
    await dashboardCacheService.invalidate(userId);
    return mapApplication(application);
  },

  async analyzeJobDescription(
    userId: string,
    data: any
  ): Promise<JobFitAnalysisResponse> {
    const context = await buildMatcherContext(userId);
    const analysis = analyzeJobFitSignals({
      description: [data.title, data.company, data.description].filter(Boolean).join('\n'),
      userSkills: context.skills,
      resumeGaps: context.resumeGaps,
      resumeScore: context.resumeScore,
      targetRole: context.targetRole,
      roadmapRole: context.roadmapRole,
      experienceLevel: context.experienceLevel
    });

    return analysis;
  },

  async createGoal(userId: string, data: any): Promise<CareerGoalResponse> {
    const goal = await jobsRepository.createGoal(userId, data);
    await dashboardCacheService.invalidate(userId);
    return mapGoal(goal);
  },

  async getGoals(userId: string): Promise<CareerGoalResponse[]> {
    return (await jobsRepository.getGoals(userId)).map(mapGoal);
  },

  async updateGoal(
    userId: string,
    id: string,
    data: any
  ): Promise<CareerGoalResponse> {
    const existing = await jobsRepository.getGoalById(userId, id);
    if (!existing) {
      throw new ApiError(404, 'Career goal not found');
    }

    const goal = await jobsRepository.updateGoal(userId, id, data);
    await dashboardCacheService.invalidate(userId);
    return mapGoal(goal);
  }
};
