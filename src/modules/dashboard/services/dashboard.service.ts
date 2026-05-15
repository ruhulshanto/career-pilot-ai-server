import { dashboardRepository } from '../repositories/dashboard.repository.js';
import { dashboardActivityService } from './dashboard-activity.service.js';
import { dashboardAiJobsService } from './dashboard-ai-jobs.service.js';
import { dashboardCacheService } from './dashboard-cache.service.js';
import { dashboardScoringService } from './dashboard-scoring.service.js';
import type {
  DashboardInsight,
  DashboardMetricSummary,
  DashboardSkillGap,
  DashboardSummary,
  DashboardTrend
} from '../types/dashboard.types.js';

const roundMetric = (value: number | null) =>
  Math.max(0, Math.min(100, Math.round(value ?? 0)));

const percentChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

const directionFor = (current: number, previous: number): DashboardTrend['direction'] => {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const textArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'name' in item) {
        return String((item as { name?: unknown }).name ?? '');
      }
      return '';
    })
    .filter(Boolean);
};

const metadataRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const sourceLabelFor = (source: string) => {
  if (source === 'LINKEDIN_SEARCH_ASSISTANT') return 'LinkedIn Search Assistant';
  if (source === 'MANUAL_TRACKED') return 'Manual Tracker';
  if (source === 'EXTERNAL_SEARCH_ASSISTANT') return 'External Job Search';
  return source
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const truncate = (value: string, maxLength = 170) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1).trim()}...` : value;

const buildTrend = (
  key: DashboardTrend['key'],
  label: string,
  current: number,
  previous: number,
  unit: DashboardTrend['unit'],
  series?: DashboardTrend['series']
): DashboardTrend => ({
  key,
  label,
  current,
  previous,
  changePercent: percentChange(current, previous),
  direction: directionFor(current, previous),
  unit,
  series
});

const buildDashboardTrends = (
  data: Awaited<ReturnType<typeof dashboardRepository.getSummaryData>>
): DashboardTrend[] => {
  const resumeScoreSeries = data.resumeScoreHistory.map((point) => ({
    date: point.createdAt.toISOString().slice(0, 10),
    value: typeof point.score === 'number' ? roundMetric(point.score) : null
  }));
  const latestResumeScore =
    resumeScoreSeries[resumeScoreSeries.length - 1]?.value ?? 0;
  const previousResumeScore =
    resumeScoreSeries[resumeScoreSeries.length - 2]?.value ?? 0;

  return [
    buildTrend(
      'resumeScore',
      'ATS score',
      latestResumeScore,
      previousResumeScore,
      'score',
      resumeScoreSeries
    ),
    buildTrend(
      'resumeAnalyses',
      'Resume analyses this week',
      data.weeklyTrendCounts.currentResumeAnalyses,
      data.weeklyTrendCounts.previousResumeAnalyses,
      'count'
    ),
    buildTrend(
      'applications',
      'Applications tracked this week',
      data.weeklyTrendCounts.currentApplications,
      data.weeklyTrendCounts.previousApplications,
      'count'
    ),
    buildTrend(
      'interviews',
      'Interview practices this week',
      data.weeklyTrendCounts.currentInterviews,
      data.weeklyTrendCounts.previousInterviews,
      'count'
    ),
    buildTrend(
      'aiUsage',
      'AI actions this week',
      data.weeklyTrendCounts.currentAiUsage,
      data.weeklyTrendCounts.previousAiUsage,
      'count'
    )
  ];
};

const buildDashboardInsights = (
  data: Awaited<ReturnType<typeof dashboardRepository.getSummaryData>>,
  metrics: DashboardMetricSummary,
  skillGaps: DashboardSkillGap[],
  careerReadiness: number
): DashboardInsight[] => {
  const insights: DashboardInsight[] = [];
  const topGap = skillGaps[0];
  const nextMilestone = data.latestRoadmap?.milestoneRecords?.[0];

  if (metrics.totalResumes === 0) {
    insights.push({
      id: 'resume-start',
      severity: 'info',
      title: 'Start with a resume analysis',
      description:
        'No uploaded resume is available yet, so readiness, gaps, and job matching are intentionally empty.',
      actionLabel: 'Upload resume',
      actionLink: '/dashboard/user/resume',
      source: 'resume'
    });
  } else if (metrics.resumesAnalyzed === 0) {
    insights.push({
      id: 'resume-waiting-analysis',
      severity: 'warning',
      title: 'Resume analysis is not complete',
      description:
        'A resume exists, but no completed AI analysis is available for score trends or gap detection.',
      actionLabel: 'Open resume',
      actionLink: '/dashboard/user/resume',
      source: 'resume'
    });
  } else if (data.latestResumeFeedback?.summary) {
    insights.push({
      id: 'resume-latest-summary',
      severity: metrics.latestResumeScore >= 75 ? 'success' : 'warning',
      title: `Latest resume score: ${metrics.latestResumeScore}/100`,
      description: truncate(data.latestResumeFeedback.summary),
      actionLabel: 'Review resume',
      actionLink: '/dashboard/user/resume',
      source: 'resume'
    });
  }

  if (topGap) {
    insights.push({
      id: `skill-gap-${topGap.skill.toLowerCase().replace(/\s+/g, '-')}`,
      severity: topGap.gapScore >= 70 ? 'warning' : 'info',
      title: `Top skill gap: ${topGap.skill}`,
      description:
        topGap.recommendation ??
        `This gap is currently your strongest improvement signal from resume, roadmap, or AI feedback data.`,
      actionLabel: 'View skill plan',
      actionLink: '/dashboard/user/skills',
      source: topGap.source === 'roadmap' ? 'roadmap' : 'ai'
    });
  }

  if (metrics.applicationsTracked === 0 && data.activeJobRecommendationCount > 0) {
    insights.push({
      id: 'applications-not-tracked',
      severity: 'info',
      title: 'Job matches exist but applications are not tracked',
      description: `${data.activeJobRecommendationCount} active recommendation${
        data.activeJobRecommendationCount === 1 ? '' : 's'
      } can be converted into a measurable job search pipeline.`,
      actionLabel: 'Review matches',
      actionLink: '/dashboard/user/skills',
      source: 'jobs'
    });
  }

  if (metrics.interviewPracticeCount === 0) {
    insights.push({
      id: 'interview-start',
      severity: 'info',
      title: 'No completed interview practice yet',
      description:
        'Completing one practice session will add real interview performance data to readiness and trend calculations.',
      actionLabel: 'Start practice',
      actionLink: '/dashboard/user/interview',
      source: 'interview'
    });
  } else if (data.interviewAverage !== null && data.interviewAverage < 70) {
    insights.push({
      id: 'interview-score-low',
      severity: 'warning',
      title: `Interview average: ${roundMetric(data.interviewAverage)}%`,
      description:
        'Recent practice scores show room to improve response structure before applying to higher-fit roles.',
      actionLabel: 'Practice again',
      actionLink: '/dashboard/user/interview',
      source: 'interview'
    });
  }

  if (!data.latestRoadmap) {
    insights.push({
      id: 'roadmap-missing',
      severity: 'info',
      title: 'No career roadmap generated yet',
      description:
        'A roadmap will turn resume and goal signals into trackable milestones instead of static recommendations.',
      actionLabel: 'Generate roadmap',
      actionLink: '/dashboard/user/roadmap',
      source: 'roadmap'
    });
  } else if (metrics.roadmapCompletion < 100 && nextMilestone) {
    insights.push({
      id: `roadmap-next-${nextMilestone.id}`,
      severity: 'info',
      title: 'Next roadmap milestone is ready',
      description: `${nextMilestone.title} is the next incomplete step for ${data.latestRoadmap.targetRole}.`,
      actionLabel: 'Continue roadmap',
      actionLink: '/dashboard/user/roadmap',
      source: 'roadmap'
    });
  } else if (metrics.roadmapCompletion === 100) {
    insights.push({
      id: 'roadmap-complete',
      severity: 'success',
      title: 'Roadmap milestones are complete',
      description:
        'Your tracked roadmap work is complete, so the next useful step is refreshing goals or generating a new path.',
      actionLabel: 'Open roadmap',
      actionLink: '/dashboard/user/roadmap',
      source: 'roadmap'
    });
  }

  if (careerReadiness >= 80) {
    insights.push({
      id: 'readiness-strong',
      severity: 'success',
      title: 'Career readiness is strong',
      description:
        'Your resume, roadmap, interview, and job signals are collectively trending toward launch readiness.',
      actionLabel: 'Ask CareerAI',
      actionLink: '/dashboard/user/chat',
      source: 'ai'
    });
  }

  return insights.slice(0, 4);
};

const buildReminderCards = (
  data: Awaited<ReturnType<typeof dashboardRepository.getSummaryData>>,
  careerReadiness: number
) => {
  const reminders = [];

  if (data.upcomingInterview?.scheduledAt) {
    reminders.push({
      id: `interview-${data.upcomingInterview.id}`,
      type: 'UPCOMING_INTERVIEW' as const,
      title: 'Upcoming interview',
      description: `${data.upcomingInterview.roleTarget} is scheduled for ${data.upcomingInterview.scheduledAt.toLocaleString()}.`,
      actionLabel: 'Open interview',
      actionLink: `/dashboard/user/interview?sessionId=${data.upcomingInterview.id}`,
      dueAt: data.upcomingInterview.scheduledAt.toISOString(),
      metadata: { interviewSessionId: data.upcomingInterview.id }
    });
  }

  const nextMilestone = data.latestRoadmap?.milestoneRecords?.[0];
  if (nextMilestone) {
    reminders.push({
      id: `roadmap-${nextMilestone.id}`,
      type: 'NEXT_ROADMAP_TASK' as const,
      title: 'Next roadmap task',
      description: `${nextMilestone.title} moves you closer to ${data.latestRoadmap?.targetRole}.`,
      actionLabel: 'View roadmap',
      actionLink: '/dashboard/user/roadmap',
      dueAt: nextMilestone.dueDate?.toISOString(),
      metadata: { roadmapId: data.latestRoadmap?.id, milestoneId: nextMilestone.id }
    });
  }

  const newestJobs = data.recommendedJobs?.slice(0, 2) ?? [];
  if (newestJobs.length > 0) {
    reminders.push({
      id: 'job-matches',
      type: 'NEWEST_JOB_MATCHES' as const,
      title: 'Newest matched jobs',
      description: `${newestJobs[0].title} at ${newestJobs[0].company} is your strongest current match.`,
      actionLabel: 'Review matches',
      actionLink: '/dashboard/user/skills',
      metadata: { jobIds: newestJobs.map((job) => job.id) }
    });
  }

  const hasCareerSignal =
    data.totalResumes > 0 ||
    data.resumesAnalyzed > 0 ||
    data.completedInterviewCount > 0 ||
    Boolean(data.latestRoadmap) ||
    data.careerGoals.length > 0;

  reminders.push(
    hasCareerSignal
      ? {
          id: 'career-mentoring',
          type: 'CAREER_MENTORING' as const,
          title: 'Career mentoring reminder',
          description:
            careerReadiness < 70
              ? 'Ask your mentor for a focused plan to raise readiness this week.'
              : "Ask your mentor to turn your progress into next week's action plan.",
          actionLabel: 'Open mentor',
          actionLink: '/dashboard/user/chat',
          metadata: { careerReadiness }
        }
      : {
          id: 'career-start',
          type: 'CAREER_MENTORING' as const,
          title: 'Create your first career signal',
          description:
            'Upload a resume first so analytics, insights, and recommendations are based on your real profile.',
          actionLabel: 'Analyze resume',
          actionLink: '/dashboard/user/resume',
          metadata: { careerReadiness }
        }
  );

  return reminders;
};

export const dashboardService = {
  async getSummary(userId: string): Promise<DashboardSummary> {
    const cached = await dashboardCacheService.get(userId);
    if (cached) return cached;

    const data = await dashboardRepository.getSummaryData(userId);
    const roadmapProgress =
      data.totalRoadmapMilestones > 0
        ? roundMetric((data.completedRoadmapMilestones / data.totalRoadmapMilestones) * 100)
        : dashboardScoringService.getRoadmapProgress(data);
    const careerReadiness = dashboardScoringService.getCareerReadiness(data);
    const topSkillGaps = dashboardScoringService.getTopSkillGaps(data);
    const metrics: DashboardMetricSummary = {
      totalResumes: data.totalResumes,
      resumesAnalyzed: data.resumesAnalyzed,
      applicationsTracked: data.applicationsTracked,
      interviewPracticeCount: data.completedInterviewCount,
      aiUsageCount: data.aiUsageCount,
      activeCareerGoals: data.activeCareerGoalCount,
      completedRoadmapMilestones: data.completedRoadmapMilestones,
      totalRoadmapMilestones: data.totalRoadmapMilestones,
      latestResumeScore: roundMetric(data.latestResumeFeedbackScore),
      roadmapCompletion: roadmapProgress
    };
    const trends = buildDashboardTrends(data);
    const insights = buildDashboardInsights(data, metrics, topSkillGaps, careerReadiness);

    const summary: DashboardSummary = {
      resumeScore: roundMetric(data.latestResumeFeedbackScore),
      interviewAverage: roundMetric(data.interviewAverage),
      careerReadiness,
      roadmapProgress,
      jobMatches: data.activeJobRecommendationCount,
      unreadNotifications: data.unreadNotificationCount,
      metrics,
      trends,
      insights,
      recentActivity: dashboardActivityService.buildRecentActivity(data),
      topSkillGaps,
      processingAiJobs: await dashboardAiJobsService.getProcessingJobs(userId, data),
      recommendedJobs: (data.recommendedJobs ?? []).map((job) => ({
        ...(() => {
          const metadata = metadataRecord(job.metadata);
          return {
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location ?? undefined,
            jobUrl: job.jobUrl ?? undefined,
            matchScore: Math.round(job.matchScore),
            skillsMatch: textArray(job.skillsMatch),
            missingSkills: textArray(metadata.missingSkills),
            matchReasons: textArray(metadata.matchReasons),
            recommendedImprovements: textArray(metadata.recommendedImprovements),
            source: job.source,
            sourceLabel:
              typeof metadata.sourceLabel === 'string'
                ? metadata.sourceLabel
                : sourceLabelFor(job.source),
            isSearchAssistant: metadata.isSearchAssistant === true,
            applicationStatus: job.applications[0]?.status
          };
        })()
      })),
      applications: (data.applications ?? []).map((application) => ({
        ...(() => {
          const metadata = metadataRecord(application.jobRecommendation.metadata);
          return {
            id: application.id,
            jobId: application.jobRecommendationId,
            title: application.jobRecommendation.title,
            company: application.jobRecommendation.company,
            location: application.jobRecommendation.location ?? undefined,
            source: application.jobRecommendation.source,
            sourceLabel:
              typeof metadata.sourceLabel === 'string'
                ? metadata.sourceLabel
                : sourceLabelFor(application.jobRecommendation.source),
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
        })()
      })),
      careerGoals: (data.careerGoals ?? []).map((goal) => ({
        id: goal.id,
        title: goal.title,
        status: goal.status,
        progress: Math.round(goal.progress),
        nextSteps: asStringArray(goal.nextSteps)
      })),
      reminders: buildReminderCards(data, careerReadiness),
      generatedAt: new Date().toISOString()
    };

    await dashboardCacheService.set(userId, summary);

    return summary;
  },

  invalidateSummary(userId: string) {
    return dashboardCacheService.invalidate(userId);
  }
};
