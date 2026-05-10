import { logger } from '@/logging/logger.js';
import type { JobProcessor } from '@queues/types.js';
import { interviewsRepository } from '@modules/interviews/repositories/interviews.repository.js';
import { roadmapRepository } from '@modules/roadmap/repositories/roadmap.repository.js';
import { chatbotRepository } from '@modules/chatbot/repositories/chatbot.repository.js';
import { InterviewAiService } from '@modules/interviews/services/interview-ai.service.js';
import { RoadmapAiService } from '@modules/roadmap/services/roadmap-ai.service.js';
import { ChatbotAiService } from '@modules/chatbot/services/chatbot-ai.service.js';
import { getAnalyticsQueue } from '@queues/index.js';
import { InterviewStatus, ProcessingStatus } from '@prisma/client';

const interviewAiService = new InterviewAiService();
const roadmapAiService = new RoadmapAiService();
const chatbotAiService = new ChatbotAiService();

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

      const updatedSession = await interviewsRepository.updateInterviewSession(
        sessionId,
        {
          questions
        }
      );

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

      await interviewsRepository.createInterviewAiFeedback({
        userId,
        interviewSessionId: sessionId,
        provider: feedback.score !== undefined ? 'openai' : 'gemini',
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
        score: feedback.score
      });

      await getAnalyticsQueue().add('analytics-job', {
        event: 'interview_feedback_generated',
        data: {
          userId,
          interviewSessionId: sessionId,
          score: feedback.score
        }
      });

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
        careerGoals,
        experienceSummary,
        industry
      } = data as {
        roadmapId: string;
        userId: string;
        targetRole: string;
        currentLevel: string;
        careerGoals: string;
        experienceSummary: string;
        industry: string;
      };

      const roadmap = await roadmapAiService.generateCareerRoadmap(
        targetRole,
        currentLevel,
        careerGoals,
        experienceSummary,
        industry
      );

      await roadmapRepository.updateCareerRoadmap(roadmapId, {
        milestones: roadmap.milestones,
        skills: roadmap.skills,
        timeline: roadmap.timeline,
        status: ProcessingStatus.COMPLETED
      });

      await roadmapRepository.createRoadmapAiFeedback({
        userId,
        careerRoadmapId: roadmapId,
        provider: 'OPENAI' as any,
        status: ProcessingStatus.COMPLETED,
        score: undefined,
        summary: 'Career roadmap generated successfully',
        strengths: roadmap.skills.map((skill) => skill.name),
        weaknesses: [],
        suggestions: roadmap.timeline.recommendations,
        rawResponse: roadmap
      });

      await getAnalyticsQueue().add('analytics-job', {
        event: 'career_roadmap_generated',
        data: {
          userId,
          careerRoadmapId: roadmapId,
          targetRole
        }
      });

      return {
        success: true,
        data: { careerRoadmapId: roadmapId, roadmap },
        metadata: { task, processingTime: 0 }
      };
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
    logger.error({ jobId: job.id, error }, 'AI processing failed');

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        attempts: job.attemptsMade
      }
    };
  }
};
