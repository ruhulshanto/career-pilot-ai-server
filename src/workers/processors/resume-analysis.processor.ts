import { logger } from '@/logging/logger.js';
import { getConfiguredPrismaAiProvider } from '@config/ai.js';
import { dashboardCacheService } from '@modules/dashboard/services/dashboard-cache.service.js';
import { notificationsService } from '@modules/notifications/services/notifications.service.js';
import { resumesRepository } from '@modules/resumes/repositories/resumes.repository.js';
import { ResumeAiService } from '@modules/resumes/services/resume-ai.service.js';
import { resumeTextExtractionService } from '@modules/resumes/services/resume-text-extraction.service.js';
import type { JobProcessor } from '@queues/types.js';
import { getAnalyticsQueue } from '@queues/index.js';
import { NotificationType, ProcessingStatus } from '@prisma/client';

const resumeAiService = new ResumeAiService();

export const resumeAnalysisProcessor: JobProcessor = async (job) => {
  logger.info({ jobId: job.id }, 'Starting resume analysis');

  const { resumeId, userId } = job.data as {
    resumeId: string;
    userId: string;
  };
  const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

  try {
    const resume = await resumesRepository.getResumeForAnalysis(resumeId);
    if (!resume) {
      logger.info(
        { jobId: job.id, resumeId, userId },
        'Skipping resume analysis because the resume no longer exists'
      );
      return {
        success: true,
        data: { resumeId, userId, skipped: true },
        metadata: { reason: 'resume_deleted' }
      };
    }

    if (resume.userId !== userId) {
      throw new Error('Resume analysis target was not found for this user');
    }

    await resumesRepository.updateResumeStatus(
      resume.id,
      ProcessingStatus.PROCESSING
    );
    await dashboardCacheService.invalidate(userId);

    const extraction = await resumeTextExtractionService.extract({
      filePath: resume.fileUrl,
      fileType: resume.fileType,
      fileSize: resume.fileSize,
      parsedText: resume.parsedText
    });
    const feedback = await resumeAiService.analyzeResume({
      title: resume.title,
      fileType: resume.fileType,
      resumeText: extraction.text
    });

    await resumesRepository.createResumeAnalysisFeedback({
      userId,
      resumeId,
      provider: getConfiguredPrismaAiProvider(),
      status: ProcessingStatus.COMPLETED,
      score: feedback.atsScore,
      summary: feedback.summary,
      strengths: feedback.strengths,
      weaknesses: [
        ...feedback.weaknesses,
        ...feedback.missingSkills.map((skill) => `Missing skill: ${skill}`),
        ...feedback.keywordGaps.map((keyword) => `Keyword gap: ${keyword}`)
      ],
      suggestions: feedback.improvementSuggestions,
      rawResponse: {
        ...feedback,
        extraction,
        analyzedAt: new Date().toISOString()
      }
    });

    await resumesRepository.updateResumeStatus(
      resume.id,
      ProcessingStatus.COMPLETED,
      extraction.text
    );

    await getAnalyticsQueue().add('analytics-job', {
      event: 'resume_analysis_completed',
      data: {
        userId,
        resumeId,
        score: feedback.atsScore,
        roleFitScore: feedback.roleFitScore
      }
    });

    await notificationsService.sendNotification({
      userId,
      type: NotificationType.SYSTEM,
      title: 'Resume analysis complete',
      message: `Your resume analysis is ready with an ATS score of ${Math.round(
        feedback.atsScore
      )}/100.`,
      actionLink: '/dashboard/user/resume',
      metadata: {
        resumeId,
        score: feedback.atsScore,
        roleFitScore: feedback.roleFitScore
      },
      dedupeKey: `resume-analysis-complete:${resumeId}`,
      channels: ['IN_APP']
    });

    await dashboardCacheService.invalidate(userId);

    logger.info({ jobId: job.id, resumeId }, 'Resume analysis completed');

    return {
      success: true,
      data: {
        resumeId,
        userId,
        analysis: feedback
      },
      metadata: {
        modelProvider: getConfiguredPrismaAiProvider()
      }
    };
  } catch (error) {
    logger.error({ jobId: job.id, error }, 'Resume analysis failed');

    if (isFinalAttempt) {
      const message =
        error instanceof Error ? error.message : 'Unknown resume analysis error';

      const failedResume = await resumesRepository.getResumeForAnalysis(resumeId);
      if (failedResume?.userId === userId) {
        await resumesRepository.updateResumeStatus(
          resumeId,
          ProcessingStatus.FAILED
        );
        await resumesRepository.createResumeAnalysisFeedback({
          userId,
          resumeId,
          provider: getConfiguredPrismaAiProvider(),
          status: ProcessingStatus.FAILED,
          summary: 'Resume analysis failed before feedback could be generated.',
          errorMessage: message,
          rawResponse: {
            error: message,
            failedAt: new Date().toISOString()
          }
        });
      }

      await getAnalyticsQueue().add('analytics-job', {
        event: 'resume_analysis_failed',
        data: {
          userId,
          resumeId,
          error: message
        }
      });

      await notificationsService.sendNotification({
        userId,
        type: NotificationType.SYSTEM,
        title: 'Resume analysis failed',
        message,
        actionLink: '/dashboard/user/resume',
        metadata: { resumeId, error: message },
        dedupeKey: `resume-analysis-failed:${resumeId}`,
        channels: ['IN_APP']
      });

      await dashboardCacheService.invalidate(userId);
    }

    throw error;
  }
};
