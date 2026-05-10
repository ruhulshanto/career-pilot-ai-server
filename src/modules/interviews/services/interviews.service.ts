import { addJobWithContext, getAnalyticsQueue } from '@queues/index.js';
import { interviewsRepository } from '@modules/interviews/repositories/interviews.repository.js';
import { createPaginationMeta } from '@shared/helpers/pagination.js';
import { ApiError } from '@shared/errors/api-error.js';
import { InterviewStatus } from '@prisma/client';
import { InterviewAiService } from './interview-ai.service.js';
import type {
  CreateInterviewSessionRequest,
  GetInterviewsQuery,
  InterviewSessionResponse,
  SubmitInterviewAnswersRequest
} from '../types/interviews.types.js';

const aiService = new InterviewAiService();

const buildPerformanceMetrics = (score?: number) => {
  if (score === undefined || score === null) {
    return undefined;
  }

  let grade: 'excellent' | 'good' | 'average' | 'needs improvement' =
    'needs improvement';

  if (score >= 90) {
    grade = 'excellent';
  } else if (score >= 75) {
    grade = 'good';
  } else if (score >= 55) {
    grade = 'average';
  }

  return {
    score,
    passed: score >= 70,
    grade,
    recommendation:
      score >= 70
        ? 'Continue refining your delivery and examples.'
        : 'Practice more in-depth responses and provide stronger evidence of impact.'
  };
};

const mapInterviewSession = (session: any): InterviewSessionResponse => ({
  id: session.id,
  userId: session.userId,
  title: session.title,
  roleTarget: session.roleTarget,
  level: session.level ?? undefined,
  status: session.status,
  questions: (session.questions as any) ?? [],
  transcript: session.transcript ?? undefined,
  score: session.score ?? undefined,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  aiFeedbacks: (session.aiFeedbacks ?? []).map((feedback: any) => ({
    id: feedback.id,
    type: feedback.type,
    provider: feedback.provider,
    status: feedback.status,
    score: feedback.score ?? undefined,
    summary: feedback.summary ?? undefined,
    strengths: feedback.strengths ?? undefined,
    weaknesses: feedback.weaknesses ?? undefined,
    suggestions: feedback.suggestions ?? undefined,
    createdAt: feedback.createdAt
  })),
  performance: buildPerformanceMetrics(session.score)
});

export const interviewsService = {
  async startInterviewSession(
    userId: string,
    payload: CreateInterviewSessionRequest
  ) {
    const interviewSession = await interviewsRepository.createInterviewSession({
      userId,
      title: payload.title,
      roleTarget: payload.roleTarget,
      level: payload.level
    });

    await addJobWithContext('ai-processing', 'generate-interview-questions', {
      task: 'generate-interview-questions',
      data: {
        sessionId: interviewSession.id,
        title: interviewSession.title,
        roleTarget: interviewSession.roleTarget,
        level: interviewSession.level ?? 'general',
        questionCount: payload.questionCount ?? 5
      }
    });

    await getAnalyticsQueue().add('analytics-job', {
      event: 'interview_session_created',
      data: {
        userId,
        interviewSessionId: interviewSession.id,
        roleTarget: interviewSession.roleTarget,
        level: interviewSession.level ?? 'general'
      }
    });

    return mapInterviewSession({
      ...interviewSession,
      questions: [],
      aiFeedbacks: []
    });
  },

  async submitInterviewAnswers(
    userId: string,
    sessionId: string,
    payload: SubmitInterviewAnswersRequest
  ) {
    const session = await interviewsRepository.getInterviewById(
      sessionId,
      userId
    );

    if (!session) {
      throw new ApiError(404, 'Interview session not found');
    }

    const questions = Array.isArray(session.questions)
      ? (session.questions as Array<{
          questionId: string;
          prompt: string;
          answer?: string;
        }>)
      : [];

    if (questions.length === 0) {
      throw new ApiError(409, 'Interview questions are not ready yet');
    }

    if (session.status === InterviewStatus.COMPLETED) {
      throw new ApiError(409, 'Interview session has already been completed');
    }

    const updatedQuestions = questions.map((question) => {
      const answer = payload.answers.find(
        (item) => item.questionId === question.questionId
      );
      return answer ? { ...question, answer: answer.answer } : question;
    });

    const transcript = {
      submittedAt: new Date().toISOString(),
      answers: payload.answers,
      notes: payload.transcript ?? null
    };

    await interviewsRepository.updateInterviewSession(sessionId, {
      questions: updatedQuestions,
      transcript,
      status: InterviewStatus.ACTIVE
    });

    await addJobWithContext('ai-processing', 'generate-interview-feedback', {
      task: 'generate-interview-feedback',
      data: {
        sessionId,
        userId,
        title: session.title,
        roleTarget: session.roleTarget,
        level: session.level ?? 'general',
        questions: updatedQuestions,
        transcript: JSON.stringify(transcript)
      }
    });

    await getAnalyticsQueue().add('analytics-job', {
      event: 'interview_answers_submitted',
      data: {
        userId,
        interviewSessionId: sessionId,
        answerCount: payload.answers.length
      }
    });

    return mapInterviewSession({
      ...session,
      questions: updatedQuestions,
      transcript,
      status: InterviewStatus.ACTIVE,
      aiFeedbacks: session.aiFeedbacks ?? []
    });
  },

  async getInterviews(userId: string, query: GetInterviewsQuery = {}) {
    const { interviewSessions, total, page, limit } =
      await interviewsRepository.getInterviews(userId, query);

    return {
      data: interviewSessions.map((session) =>
        mapInterviewSession({ ...session, aiFeedbacks: [] })
      ),
      pagination: createPaginationMeta(total, page, limit)
    };
  },

  async getInterviewById(userId: string, id: string) {
    const session = await interviewsRepository.getInterviewById(id, userId);
    if (!session) {
      return null;
    }

    return mapInterviewSession(session);
  }
};
