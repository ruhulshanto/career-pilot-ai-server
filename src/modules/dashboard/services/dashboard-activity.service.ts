import type {
  DashboardActivity,
  DashboardRawData
} from '../types/dashboard.types.js';

const toIso = (date: Date) => date.toISOString();

const titleFromEventName = (eventName: string) =>
  eventName
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const describeProcessing = (status: string) => {
  if (status === 'COMPLETED') return 'completed successfully';
  if (status === 'FAILED') return 'needs attention';
  if (status === 'PROCESSING') return 'is being processed';
  return 'is queued for processing';
};

export const dashboardActivityService = {
  buildRecentActivity(data: DashboardRawData, limit = 10): DashboardActivity[] {
    const analyticsActivities = data.recentAnalyticsEvents.map(
      (event): DashboardActivity => ({
        id: `analytics:${event.id}`,
        source: 'analytics',
        eventType: event.eventType,
        title: titleFromEventName(event.eventName),
        description: event.entityType
          ? `${event.entityType} activity was recorded.`
          : 'Platform activity was recorded.',
        entityType: event.entityType ?? undefined,
        entityId: event.entityId ?? undefined,
        createdAt: toIso(event.createdAt)
      })
    );

    const resumeActivities = data.recentResumes.map(
      (resume): DashboardActivity => ({
        id: `resume:${resume.id}`,
        source: 'resume',
        eventType: 'RESUME',
        title: `Resume ${describeProcessing(resume.status)}`,
        description: resume.title,
        entityType: 'resume',
        entityId: resume.id,
        createdAt: toIso(resume.updatedAt ?? resume.createdAt)
      })
    );

    const interviewActivities = data.recentInterviews.map(
      (interview): DashboardActivity => ({
        id: `interview:${interview.id}`,
        source: 'interview',
        eventType: 'INTERVIEW',
        title:
          interview.status === 'COMPLETED'
            ? 'Interview practice completed'
            : `Interview ${describeProcessing(interview.status)}`,
        description: `${interview.title} for ${interview.roleTarget}`,
        entityType: 'interview',
        entityId: interview.id,
        score: interview.score ?? undefined,
        createdAt: toIso(interview.completedAt ?? interview.updatedAt)
      })
    );

    const roadmapActivities = data.recentRoadmaps.map(
      (roadmap): DashboardActivity => ({
        id: `roadmap:${roadmap.id}`,
        source: 'roadmap',
        eventType: 'ROADMAP',
        title: `Roadmap ${describeProcessing(roadmap.status)}`,
        description: `Career roadmap for ${roadmap.targetRole}`,
        entityType: 'roadmap',
        entityId: roadmap.id,
        createdAt: toIso(roadmap.updatedAt ?? roadmap.createdAt)
      })
    );

    const feedbackActivities = data.recentAiFeedbacks.map(
      (feedback): DashboardActivity => ({
        id: `ai-feedback:${feedback.id}`,
        source: 'ai-feedback',
        eventType: 'AI',
        title: `${titleFromEventName(feedback.type)} ${describeProcessing(feedback.status)}`,
        description: feedback.summary ?? 'AI feedback was generated from platform data.',
        entityType: feedback.resumeId
          ? 'resume'
          : feedback.interviewSessionId
            ? 'interview'
            : feedback.careerRoadmapId
              ? 'roadmap'
              : 'ai-feedback',
        entityId:
          feedback.resumeId ??
          feedback.interviewSessionId ??
          feedback.careerRoadmapId ??
          feedback.id,
        score: feedback.score ?? undefined,
        createdAt: toIso(feedback.updatedAt ?? feedback.createdAt)
      })
    );

    return [
      ...analyticsActivities,
      ...resumeActivities,
      ...interviewActivities,
      ...roadmapActivities,
      ...feedbackActivities
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limit);
  }
};
