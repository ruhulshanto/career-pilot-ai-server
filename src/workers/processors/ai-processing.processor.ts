import { logger } from '@/logging/logger.js';
import {
  AI_SERVICE_UNAVAILABLE_MESSAGE,
  getAiProviderQuotaBlockedUntil
} from '@ai/clients/ai-client.js';
import {
  getConfiguredAiProvider,
  getConfiguredPrismaAiProvider
} from '@config/ai.js';
import type { JobProcessor } from '@queues/types.js';
import { interviewsRepository } from '@modules/interviews/repositories/interviews.repository.js';
import { roadmapRepository } from '@modules/roadmap/repositories/roadmap.repository.js';
import { notificationsService } from '@modules/notifications/services/notifications.service.js';
import { chatbotRepository } from '@modules/chatbot/repositories/chatbot.repository.js';
import { dashboardCacheService } from '@modules/dashboard/services/dashboard-cache.service.js';
import { InterviewAiService } from '@modules/interviews/services/interview-ai.service.js';
import { RoadmapAiService } from '@modules/roadmap/services/roadmap-ai.service.js';
import { ChatbotAiService } from '@modules/chatbot/services/chatbot-ai.service.js';
import { addJobWithContext, createSafeJobId, getAnalyticsQueue } from '@queues/index.js';
import { InterviewStatus, NotificationType, ProcessingStatus } from '@prisma/client';

const interviewAiService = new InterviewAiService();
const roadmapAiService = new RoadmapAiService();
const chatbotAiService = new ChatbotAiService();
const MAX_ROADMAP_AI_RETRY_COUNT = 3;
const INTERVIEW_STATUS_IN_PROGRESS = InterviewStatus.IN_PROGRESS;

const buildRoadmapRetryMessage = (
  message: string,
  retryAfterMs: number,
  retryAttempt: number
) => {
  const retryAvailableAt = new Date(Date.now() + retryAfterMs);
  return `${message} CareerAI will retry automatically at ${retryAvailableAt.toLocaleString()}. [retry:availableAt=${retryAvailableAt.toISOString()};attempt=${retryAttempt};limit=${MAX_ROADMAP_AI_RETRY_COUNT}]`;
};

export const aiProcessingProcessor: JobProcessor = async (job) => {
  logger.info({ jobId: job.id }, 'Starting AI processing');

  try {
    const { task, data } = job.data as {
      task: string;
      data: Record<string, unknown>;
    };

    if (task === 'generate-interview-questions') {
      const { sessionId, title, roleTarget, level, questionCount } = data as {
        sessionId: string;
        title: string;
        roleTarget: string;
        level: string;
        questionCount: number;
      };

      const questions = await interviewAiService.generateInterviewQuestions(
        title,
        roleTarget,
        level,
        questionCount
      );

      const existingSession =
        await interviewsRepository.getInterviewSessionMeta(sessionId);
      const shouldActivate =
        !existingSession?.scheduledAt ||
        existingSession.scheduledAt.getTime() <= Date.now();
      const updatedSession = await interviewsRepository.updateInterviewSession(
        sessionId,
        {
          questions,
          ...(shouldActivate
            ? { status: INTERVIEW_STATUS_IN_PROGRESS, startedAt: new Date() }
            : {})
        }
      );
      const userId = typeof updatedSession.userId === 'string' ? updatedSession.userId : undefined;
      if (userId) {
        await dashboardCacheService.invalidate(userId);
      }

      return {
        success: true,
        data: { interviewSessionId: sessionId, questions, updatedSession },
        metadata: { task, processingTime: 0 }
      };
    }

    if (task === 'generate-interview-feedback') {
      const {
        sessionId,
        userId,
        title,
        roleTarget,
        level,
        questions,
        transcript
      } = data as {
        sessionId: string;
        userId: string;
        title: string;
        roleTarget: string;
        level: string;
        questions: Array<{
          questionId: string;
          prompt: string;
          answer?: string;
        }>;
        transcript: string;
      };

      const feedback = await interviewAiService.generateInterviewFeedback(
        title,
        roleTarget,
        level,
        questions,
        transcript
      );

      const createdFeedback = await interviewsRepository.createInterviewAiFeedback({
        userId,
        interviewSessionId: sessionId,
        provider: getConfiguredPrismaAiProvider(),
        status: ProcessingStatus.COMPLETED,
        score: feedback.score,
        summary: feedback.summary,
        strengths: feedback.strengths,
        weaknesses: feedback.weaknesses,
        suggestions: feedback.suggestions,
        rawResponse: {
          questions,
          transcript,
          feedback
        }
      });

      await interviewsRepository.updateInterviewSession(sessionId, {
        status: InterviewStatus.COMPLETED,
        score: feedback.score,
        completedAt: new Date()
      });

      await getAnalyticsQueue().add('analytics-job', {
        event: 'interview_feedback_generated',
        data: {
          userId,
          interviewSessionId: sessionId,
          score: feedback.score
        }
      });
      await notificationsService.notifyInterviewFeedbackAvailable({
        userId,
        sessionId,
        title,
        roleTarget,
        score: feedback.score,
        feedbackId: createdFeedback.id
      });
      await dashboardCacheService.invalidate(userId);

      return {
        success: true,
        data: { interviewSessionId: sessionId, feedback },
        metadata: { task, processingTime: 0 }
      };
    }

    if (task === 'generate-career-roadmap') {
      const {
        roadmapId,
        userId,
        targetRole,
        currentLevel,
        preferredPath,
        careerGoals,
        industry,
        sourceResumeId
      } = data as {
        roadmapId: string;
        userId: string;
        targetRole: string;
        currentLevel: string;
        preferredPath: string;
        careerGoals?: string;
        industry?: string;
        sourceResumeId?: string;
        retryCount?: number;
      };

      try {
        const roadmapRecord =
          await roadmapRepository.getCareerRoadmapForProcessing(roadmapId, userId);
        if (!roadmapRecord) {
          throw new Error('Roadmap generation target was not found for this user');
        }

        await roadmapRepository.updateRoadmapStatus(
          roadmapId,
          ProcessingStatus.PROCESSING
        );
        await dashboardCacheService.invalidate(userId);

        const resumeContext = await roadmapRepository.getLatestResumeContext(
          userId,
          sourceResumeId
        );
        const feedback = resumeContext?.aiFeedbacks?.[0];
        const raw = feedback?.rawResponse as Record<string, unknown> | undefined;

        const roadmap = await roadmapAiService.generateCareerRoadmap({
          targetRole,
          currentLevel,
          preferredPath,
          careerGoals,
          industry,
          resumeText: resumeContext?.parsedText ?? undefined,
          resumeSummary: feedback?.summary ?? undefined,
          strengths: textArray(raw?.strengths ?? feedback?.strengths),
          weaknesses: textArray(raw?.weaknesses ?? feedback?.weaknesses),
          missingSkills: textArray(raw?.missingSkills),
          improvementSuggestions: textArray(
            raw?.improvementSuggestions ?? feedback?.suggestions
          ),
          keywordGaps: textArray(raw?.keywordGaps),
          recommendedNextActions: textArray(raw?.recommendedNextActions)
        });

        await roadmapRepository.completeGeneratedRoadmap(roadmapId, roadmap);

        await roadmapRepository.createRoadmapAiFeedback({
          userId,
          careerRoadmapId: roadmapId,
          provider: getConfiguredPrismaAiProvider(),
          status: ProcessingStatus.COMPLETED,
          score: 0,
          summary: roadmap.summary,
          strengths: roadmap.skills.map((skill) => skill.name),
          weaknesses: roadmap.skills
            .filter((skill) => ['high', 'critical'].includes(skill.priority))
            .map((skill) => skill.name),
          suggestions: roadmap.learningRecommendations,
          rawResponse: {
            roadmap,
            sourceResumeId: resumeContext?.id ?? null
          }
        });

        await getAnalyticsQueue().add('analytics-job', {
          event: 'career_roadmap_generated',
          data: {
            userId,
            careerRoadmapId: roadmapId,
            targetRole,
            estimatedDurationMonths: roadmap.estimatedDurationMonths
          }
        });

        await notificationsService.sendNotification({
          userId,
          type: NotificationType.ROADMAP_REMINDER,
          title: 'Career roadmap ready',
          message: `Your personalized ${roadmap.targetRole} roadmap is ready with ${roadmap.milestones.length} milestones.`,
          actionLink: '/dashboard/user/roadmap',
          metadata: {
            careerRoadmapId: roadmapId,
            targetRole: roadmap.targetRole
          },
          dedupeKey: `roadmap-ready:${roadmapId}`,
          channels: ['IN_APP']
        });
        await dashboardCacheService.invalidate(userId);

        return {
          success: true,
          data: { careerRoadmapId: roadmapId, roadmap },
          metadata: { task, processingTime: 0 }
        };
      } catch (error) {
        let message = getRoadmapGenerationErrorMessage(error);
        const retryDelayMs = getRoadmapRetryDelayMs(error);
        const quotaCooldownMs = getRoadmapQuotaCooldownMs(error);
        const retryCount = Number(data.retryCount ?? 0);

        if (retryDelayMs && retryCount < MAX_ROADMAP_AI_RETRY_COUNT) {
          const nextRetryAttempt = retryCount + 1;
          await roadmapRepository.updateRoadmapStatus(
            roadmapId,
            ProcessingStatus.PENDING,
            buildRoadmapRetryMessage(message, retryDelayMs, nextRetryAttempt)
          );

          await addJobWithContext(
            'ai-processing',
            'generate-career-roadmap',
            {
              task: 'generate-career-roadmap',
              data: {
                roadmapId,
                userId,
                targetRole,
                currentLevel,
                preferredPath,
                careerGoals,
                industry,
                sourceResumeId,
                retryCount: nextRetryAttempt
              }
            },
            {
              jobId: createSafeJobId(
                'roadmap',
                'generate',
                roadmapId,
                'retry',
                nextRetryAttempt
              ),
              delay: retryDelayMs,
              attempts: 1
            }
          );

          await notificationsService.sendNotification({
            userId,
            type: NotificationType.SYSTEM,
            title: 'Career roadmap retry scheduled',
            message,
            actionLink: '/dashboard/user/roadmap',
            metadata: {
              careerRoadmapId: roadmapId,
              retryAfterMs: retryDelayMs
            },
            dedupeKey: `roadmap-retry:${roadmapId}:${nextRetryAttempt}`,
            channels: ['IN_APP']
          });
          await dashboardCacheService.invalidate(userId);

          return {
            success: true,
            data: { careerRoadmapId: roadmapId, retryAfterMs: retryDelayMs },
            metadata: { task, retryScheduled: true, processingTime: 0 }
          };
        }

        if (quotaCooldownMs) {
          message =
            'AI service is experiencing high demand. Please try again later.';
        }

        if (retryDelayMs && retryCount >= MAX_ROADMAP_AI_RETRY_COUNT) {
          message =
            'AI service is experiencing high demand. Please try again later.';
        }

        await roadmapRepository.updateRoadmapStatus(
          roadmapId,
          ProcessingStatus.FAILED,
          message
        );

        await roadmapRepository.createRoadmapAiFeedback({
          userId,
          careerRoadmapId: roadmapId,
          provider: getConfiguredPrismaAiProvider(),
          status: ProcessingStatus.FAILED,
          summary: 'Career roadmap generation failed.',
          rawResponse: {
            error: message,
            failedAt: new Date().toISOString()
          },
          errorMessage: message
        });

        await getAnalyticsQueue().add('analytics-job', {
          event: 'career_roadmap_generation_failed',
          data: { userId, careerRoadmapId: roadmapId, targetRole, error: message }
        });

        await notificationsService.sendNotification({
          userId,
          type: NotificationType.SYSTEM,
          title: 'Career roadmap generation failed',
          message,
          actionLink: '/dashboard/user/roadmap',
          metadata: { careerRoadmapId: roadmapId, error: message },
          dedupeKey: `roadmap-failed:${roadmapId}`,
          channels: ['IN_APP']
        });
        await dashboardCacheService.invalidate(userId);
        throw error;
      }
    }

    if (task === 'generate-chatbot-response') {
      const { sessionId, userId, userMessage, context } = data as {
        sessionId: string;
        userId: string;
        userMessage: string;
        context: any;
      };

      const aiResponse = await chatbotAiService.generateResponse(
        userMessage,
        sessionId,
        context
      );

      // Use the chatbot service to handle the response
      const { chatbotService } =
        await import('@modules/chatbot/services/chatbot.service.js');
      await chatbotService.handleAiResponse(sessionId, userId, aiResponse);
      await dashboardCacheService.invalidate(userId);

      return {
        success: true,
        data: {
          sessionId,
          messageId: aiResponse.messageId,
          content: aiResponse.content
        },
        metadata: { task, processingTime: 0 }
      };
    }

    logger.warn(
      { jobId: job.id, task },
      'Unknown AI task, falling back to default processing'
    );

    return {
      success: true,
      data: {
        task,
        result: {
          processed: true,
          output: 'Unsupported AI task executed as fallback'
        }
      },
      metadata: {
        processingTime: 3000,
        tokens: 150
      }
    };
  } catch (error) {
    const retryable = isRetryableAiProcessingError(error);
    logger.error({ jobId: job.id, error }, 'AI processing failed');

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        attempts: job.attemptsMade,
        retryable,
        code: getAiProcessingErrorCode(error)
      }
    };
  }
};

const getAiProcessingErrorCode = (error: unknown) =>
  error &&
  typeof error === 'object' &&
  'code' in error &&
  typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : undefined;

const isRetryableAiProcessingError = (error: unknown) => {
  const code = getAiProcessingErrorCode(error);
  if (!code) return true;

  if (
    [
      'MODEL_NOT_FOUND',
      'REQUEST_TOO_LARGE',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'VALIDATION_ERROR'
    ].includes(code)
  ) {
    return false;
  }

  return [
    'SERVICE_UNAVAILABLE',
    'TIMEOUT',
    'EMPTY_AI_RESPONSE',
    'JSON_PARSE_ERROR',
    'INVALID_AI_RESPONSE'
  ].includes(code);
};

const textArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'text' in item) {
        const text = (item as { text?: unknown }).text;
        return typeof text === 'string' ? text : null;
      }
      if (item && typeof item === 'object' && 'title' in item) {
        const title = (item as { title?: unknown }).title;
        return typeof title === 'string' ? title : null;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
};

const getRoadmapGenerationErrorMessage = (error: unknown) => {
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : undefined;

  if (code === 'SERVICE_UNAVAILABLE' || code === 'TIMEOUT') {
    return AI_SERVICE_UNAVAILABLE_MESSAGE;
  }

  if (code === 'MODEL_NOT_FOUND') {
    return 'The configured AI model is not available. Please update the AI model and try again.';
  }

  if (code === 'REQUEST_TOO_LARGE') {
    return 'The AI request is too large. Please shorten the resume or career goals and try again.';
  }

  if (code === 'QUOTA_EXCEEDED') {
    return 'AI service is experiencing high demand. Please try again later.';
  }

  if (
    code === 'JSON_PARSE_ERROR' ||
    code === 'INVALID_AI_RESPONSE' ||
    code === 'EMPTY_AI_RESPONSE'
  ) {
    return 'There was an issue processing your roadmap. Please try again later.';
  }

  return error instanceof Error ? error.message : 'Unknown roadmap error';
};

const getRoadmapRetryDelayMs = (error: unknown) => {
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : undefined;

  if (code !== 'SERVICE_UNAVAILABLE' && code !== 'TIMEOUT') {
    return null;
  }

  const details =
    error &&
    typeof error === 'object' &&
    'details' in error &&
    typeof (error as { details?: unknown }).details === 'object'
      ? ((error as { details?: Record<string, unknown> }).details ?? {})
      : {};
  const retryAfterMs =
    typeof details.retryAfterMs === 'number' ? details.retryAfterMs : null;
  const providerCooldown = getAiProviderQuotaBlockedUntil(getConfiguredAiProvider());

  if (retryAfterMs && retryAfterMs > 0) {
    return retryAfterMs;
  }

  if (providerCooldown) {
    return Math.max(0, providerCooldown - Date.now());
  }

  return 10 * 60 * 1000;
};

const getRoadmapQuotaCooldownMs = (error: unknown) => {
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : undefined;

  if (code !== 'QUOTA_EXCEEDED') {
    return null;
  }

  const providerCooldown = getAiProviderQuotaBlockedUntil(getConfiguredAiProvider());
  return providerCooldown ? Math.max(0, providerCooldown - Date.now()) : 60 * 60 * 1000;
};
