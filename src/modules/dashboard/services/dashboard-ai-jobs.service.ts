import { getAiProcessingQueue, getResumeAnalysisQueue } from '@queues/index.js';
import { logger } from '@/logging/logger.js';
import type { Job } from 'bullmq';
import { AiFeedbackType } from '@prisma/client';
import type {
  DashboardAiJob,
  DashboardRawData
} from '../types/dashboard.types.js';

const toIso = (date: Date | number | string | undefined) => {
  if (!date) return new Date().toISOString();
  return new Date(date).toISOString();
};

const statusStage = (status: string) => {
  if (status === 'PENDING') return 'Queued';
  if (status === 'PROCESSING') return 'Generating AI output';
  if (status === 'WAITING') return 'Waiting for worker capacity';
  if (status === 'ACTIVE') return 'Worker is processing';
  if (status === 'DELAYED') return 'Scheduled for retry';
  return 'Processing';
};

const isAiFeedbackType = (value: unknown): value is AiFeedbackType =>
  typeof value === 'string' &&
  Object.values(AiFeedbackType).includes(value as AiFeedbackType);

export const dashboardAiJobsService = {
  async getProcessingJobs(
    userId: string,
    data: DashboardRawData
  ): Promise<DashboardAiJob[]> {
    const databaseJobs: DashboardAiJob[] = [
      ...data.activeProcessingRecords.resumes.map(
        (resume): DashboardAiJob => ({
          id: `resume:${resume.id}`,
          type: 'RESUME_ANALYSIS',
          entityType: 'resume',
          entityId: resume.id,
          status: resume.status,
          progressStage: statusStage(resume.status),
          createdAt: toIso(resume.createdAt),
          updatedAt: toIso(resume.updatedAt)
        })
      ),
      ...data.activeProcessingRecords.roadmaps.map(
        (roadmap): DashboardAiJob => ({
          id: `roadmap:${roadmap.id}`,
          type: 'ROADMAP_GENERATION',
          entityType: 'roadmap',
          entityId: roadmap.id,
          status: roadmap.status,
          progressStage: statusStage(roadmap.status),
          createdAt: toIso(roadmap.createdAt),
          updatedAt: toIso(roadmap.updatedAt)
        })
      ),
      ...data.activeProcessingRecords.aiFeedbacks.map(
        (feedback): DashboardAiJob => {
          const entityType = feedback.resumeId
            ? 'resume'
            : feedback.interviewSessionId
              ? 'interview'
              : feedback.careerRoadmapId
                ? 'roadmap'
                : 'ai-feedback';

          return {
            id: `ai-feedback:${feedback.id}`,
            type: feedback.type,
            entityType,
            entityId:
              feedback.resumeId ??
              feedback.interviewSessionId ??
              feedback.careerRoadmapId ??
              feedback.id,
            status: feedback.status,
            progressStage: statusStage(feedback.status),
            createdAt: toIso(feedback.createdAt),
            updatedAt: toIso(feedback.updatedAt)
          };
        }
      )
    ];

    const queueJobs = await this.getQueueJobs(userId);
    const seen = new Set(databaseJobs.map((job) => `${job.entityType}:${job.entityId}`));

    return [
      ...databaseJobs,
      ...queueJobs.filter((job) => !seen.has(`${job.entityType}:${job.entityId}`))
    ]
      .sort(
        (a, b) =>
          new Date(b.updatedAt ?? b.createdAt).getTime() -
          new Date(a.updatedAt ?? a.createdAt).getTime()
      )
      .slice(0, 10);
  },

  async getQueueJobs(userId: string): Promise<DashboardAiJob[]> {
    try {
      const [resumeJobs, aiJobs] = await Promise.all([
        getResumeAnalysisQueue().getJobs(['waiting', 'active', 'delayed'], 0, 10),
        getAiProcessingQueue().getJobs(['waiting', 'active', 'delayed'], 0, 10)
      ]);

      const userJob = (job: Job) => {
        const jobData = job.data as Record<string, unknown>;
        const nestedData = jobData.data as Record<string, unknown> | undefined;
        return jobData.userId === userId || nestedData?.userId === userId;
      };

      const normalize = async (
        job: Job,
        queueName: string,
        fallbackType: DashboardAiJob['type']
      ): Promise<DashboardAiJob> => {
        const state = (await job.getState()).toUpperCase() as
          | 'WAITING'
          | 'ACTIVE'
          | 'DELAYED';
        const rootData = (job.data ?? {}) as Record<string, unknown>;
        const data = {
          ...rootData,
          ...((rootData.data as Record<string, unknown> | undefined) ?? {})
        };
        const resumeId = typeof data.resumeId === 'string' ? data.resumeId : undefined;
        const careerRoadmapId =
          typeof data.careerRoadmapId === 'string'
            ? data.careerRoadmapId
            : typeof data.roadmapId === 'string'
              ? data.roadmapId
              : undefined;
        const interviewSessionId =
          typeof data.interviewSessionId === 'string'
            ? data.interviewSessionId
            : typeof data.sessionId === 'string'
              ? data.sessionId
              : undefined;
        const entityId =
          resumeId ??
          careerRoadmapId ??
          interviewSessionId ??
          (typeof data.entityId === 'string' ? data.entityId : undefined) ??
          String(job.id);
        const entityType = resumeId
          ? 'resume'
          : careerRoadmapId
            ? 'roadmap'
            : interviewSessionId
              ? 'interview'
              : fallbackType === 'RESUME_ANALYSIS'
                ? 'resume'
                : 'ai-feedback';

        return {
          id: `queue:${queueName}:${job.id}`,
          type: isAiFeedbackType(data.type) ? data.type : fallbackType,
          entityType,
          entityId,
          status: state,
          progressStage: statusStage(state),
          progress:
            typeof job.progress === 'number'
              ? job.progress
              : undefined,
          createdAt: toIso(job.timestamp),
          updatedAt: toIso(job.processedOn ?? job.timestamp)
        };
      };

      return Promise.all([
        ...resumeJobs
          .filter(userJob)
          .map((job) => normalize(job, 'resume-analysis', 'RESUME_ANALYSIS')),
        ...aiJobs
          .filter(userJob)
          .map((job) => normalize(job, 'ai-processing', 'INTERVIEW_FEEDBACK'))
      ]);
    } catch (err) {
      logger.error({ err }, 'Failed to read AI processing queue status');
      return [];
    }
  }
};
