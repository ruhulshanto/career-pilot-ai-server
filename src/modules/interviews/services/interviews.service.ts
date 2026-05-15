import { addJobWithContext, createSafeJobId, getAnalyticsQueue } from '@queues/index.js';
import { dashboardCacheService } from '@modules/dashboard/services/dashboard-cache.service.js';
import { interviewsRepository } from '@modules/interviews/repositories/interviews.repository.js';
import { createPaginationMeta } from '@shared/helpers/pagination.js';
import { ApiError } from '@shared/errors/api-error.js';
import { InterviewStatus } from '@prisma/client';
import { InterviewAiService } from './interview-ai.service.js';
import type {
  CreateInterviewSessionRequest,
  GetInterviewSlotsQuery,
  GetInterviewsQuery,
  InterviewSlot,
  InterviewSessionResponse,
  SubmitInterviewAnswersRequest
} from '../types/interviews.types.js';

const aiService = new InterviewAiService();
const SLOT_HOURS = [9, 10, 11, 13, 14, 15, 16, 17];
const SLOT_DURATION_MINUTES = 45;
const DEFAULT_SLOT_CAPACITY = 3;
const INTERVIEW_STATUS_IN_PROGRESS = InterviewStatus.IN_PROGRESS;

const normalizeScheduleText = (value?: string, fallback = 'General') =>
  (value ?? fallback).replace(/\s+/g, ' ').trim() || fallback;

const getLocalDateParts = (dateText?: string) => {
  const source = dateText ?? new Date().toISOString().slice(0, 10);
  const [year, month, day] = source.split('-').map(Number);

  return {
    year,
    month,
    day
  };
};

const localDateTimeToUtc = (
  date: { year: number; month: number; day: number },
  hour: number,
  timezoneOffsetMinutes: number
) =>
  new Date(
    Date.UTC(date.year, date.month - 1, date.day, hour, 0, 0, 0) +
      timezoneOffsetMinutes * 60_000
  );

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

const getQuestionFeedback = (feedback: any) => {
  const rawResponse = feedback.rawResponse as
    | {
        feedback?: {
          questionFeedback?: unknown;
        };
        questionFeedback?: unknown;
      }
    | undefined;
  const questionFeedback =
    rawResponse?.feedback?.questionFeedback ?? rawResponse?.questionFeedback;

  if (!Array.isArray(questionFeedback)) {
    return undefined;
  }

  return questionFeedback
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const value = item as Record<string, unknown>;
      return {
        questionId:
          typeof value.questionId === 'string' ? value.questionId : '',
        score: typeof value.score === 'number' ? value.score : 0,
        whatWorked: Array.isArray(value.whatWorked)
          ? value.whatWorked.filter((entry): entry is string => typeof entry === 'string')
          : [],
        improve: Array.isArray(value.improve)
          ? value.improve.filter((entry): entry is string => typeof entry === 'string')
          : [],
        strongerAnswer:
          typeof value.strongerAnswer === 'string'
            ? value.strongerAnswer
            : 'Add a clearer example, action, and measurable result.'
      };
    })
    .filter(
      (
        item
      ): item is {
        questionId: string;
        score: number;
        whatWorked: string[];
        improve: string[];
        strongerAnswer: string;
      } => Boolean(item?.questionId)
    );
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
  scheduledAt: session.scheduledAt ?? undefined,
  startedAt: session.startedAt ?? undefined,
  completedAt: session.completedAt ?? undefined,
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
    questionFeedback: getQuestionFeedback(feedback),
    createdAt: feedback.createdAt
  })),
  performance: buildPerformanceMetrics(session.score)
});

const isScheduledForFuture = (scheduledAt?: Date | null) =>
  Boolean(scheduledAt && scheduledAt.getTime() > Date.now());

const activateInterviewIfReady = async (session: any) => {
  if (
    session.status !== InterviewStatus.SCHEDULED ||
    isScheduledForFuture(session.scheduledAt)
  ) {
    return session;
  }

  return interviewsRepository.updateInterviewSession(session.id, {
    status: INTERVIEW_STATUS_IN_PROGRESS,
    startedAt: new Date()
  });
};

export const interviewsService = {
  async getAvailableSlots(
    userId: string,
    query: GetInterviewSlotsQuery = {}
  ): Promise<InterviewSlot[]> {
    const days = query.days ?? 7;
    const roleTarget = normalizeScheduleText(
      query.roleTarget,
      'General Mock Interview'
    );
    const level = normalizeScheduleText(query.level, 'General');
    const timezoneOffsetMinutes =
      typeof query.timezoneOffsetMinutes === 'number'
        ? query.timezoneOffsetMinutes
        : new Date().getTimezoneOffset();
    const localDate = getLocalDateParts(query.date);
    const startDate = localDateTimeToUtc(localDate, 0, timezoneOffsetMinutes);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);
    const clientNow = query.now ? new Date(query.now) : new Date();
    const nowMs = Number.isNaN(clientNow.getTime())
      ? Date.now()
      : clientNow.getTime();

    await interviewsRepository.ensureAvailabilityForRoleLevel({
      roleTarget,
      level,
      localDate,
      timezoneOffsetMinutes,
      days,
      slotHours: SLOT_HOURS,
      durationMinutes: SLOT_DURATION_MINUTES,
      capacity: DEFAULT_SLOT_CAPACITY
    });

    const availability = await interviewsRepository.getAvailableInterviewerSlots({
      roleTarget,
      level,
      startAt: startDate,
      endAt: endDate
    });
    return availability
      .filter(
        (slot) =>
          slot.startsAt.getTime() > nowMs + 5 * 60 * 1000 &&
          slot.bookedCount < slot.capacity
      )
      .map((slot) => ({
        availabilityId: slot.id,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        label: slot.startsAt.toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        }),
        available: true,
        capacity: slot.capacity,
        remainingCapacity: Math.max(0, slot.capacity - slot.bookedCount),
        roleTarget: slot.roleTarget,
        level: slot.level ?? undefined
      }));
  },

  async startInterviewSession(
    userId: string,
    payload: CreateInterviewSessionRequest
  ) {
    const scheduledAt = payload.scheduledAt
      ? new Date(payload.scheduledAt)
      : undefined;

    if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
      throw new ApiError(400, 'Interview slot must be in the future');
    }

    const startsInFuture = isScheduledForFuture(scheduledAt);
    const roleTarget = normalizeScheduleText(payload.roleTarget);
    const level = normalizeScheduleText(payload.level, 'General');

    const interviewSession = scheduledAt
      ? await interviewsRepository.bookAvailabilitySlot({
          userId,
          title: payload.title,
          roleTarget,
          level,
          scheduledAt,
          status: startsInFuture
            ? InterviewStatus.SCHEDULED
            : INTERVIEW_STATUS_IN_PROGRESS
        })
      : await interviewsRepository.createInterviewSession({
          userId,
          title: payload.title,
          roleTarget,
          level,
          scheduledAt,
          status: INTERVIEW_STATUS_IN_PROGRESS,
          startedAt: new Date()
        });

    if (!interviewSession) {
      throw new ApiError(409, 'That interview slot has no remaining capacity');
    }

    await addJobWithContext('ai-processing', 'generate-interview-questions', {
      task: 'generate-interview-questions',
      data: {
        sessionId: interviewSession.id,
        title: interviewSession.title,
        roleTarget: interviewSession.roleTarget,
        level: interviewSession.level ?? 'general',
        questionCount: payload.questionCount ?? 5
      }
    }, {
      jobId: createSafeJobId('interview', 'questions', interviewSession.id),
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 }
    });

    await getAnalyticsQueue().add('analytics-job', {
      event: 'interview_session_created',
      data: {
        userId,
        interviewSessionId: interviewSession.id,
        roleTarget: interviewSession.roleTarget,
        level: interviewSession.level ?? 'general',
        scheduledAt: interviewSession.scheduledAt?.toISOString() ?? null
      }
    });
    await dashboardCacheService.invalidate(userId);

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

    if (isScheduledForFuture(session.scheduledAt)) {
      throw new ApiError(409, 'Interview session has not started yet');
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

    const activatedSession = await activateInterviewIfReady(session);

    await interviewsRepository.updateInterviewSession(sessionId, {
      questions: updatedQuestions,
      transcript,
      status: INTERVIEW_STATUS_IN_PROGRESS,
      startedAt: activatedSession.startedAt ?? new Date()
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
    }, {
      jobId: createSafeJobId('interview', 'feedback', sessionId),
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    });

    await getAnalyticsQueue().add('analytics-job', {
      event: 'interview_answers_submitted',
      data: {
        userId,
        interviewSessionId: sessionId,
        answerCount: payload.answers.length
      }
    });
    await dashboardCacheService.invalidate(userId);

    return mapInterviewSession({
      ...session,
      questions: updatedQuestions,
      transcript,
      status: INTERVIEW_STATUS_IN_PROGRESS,
      startedAt: activatedSession.startedAt,
      aiFeedbacks: session.aiFeedbacks ?? []
    });
  },

  async getInterviews(userId: string, query: GetInterviewsQuery = {}) {
    await interviewsRepository.activateDueScheduledInterviews(
      userId,
      new Date()
    );

    const { interviewSessions, total, page, limit } =
      await interviewsRepository.getInterviews(userId, query);

    return {
      data: interviewSessions.map((session) =>
        mapInterviewSession({ ...session, aiFeedbacks: [] })
      ),
      pagination: createPaginationMeta(page, limit, total)
    };
  },

  async getInterviewById(userId: string, id: string) {
    const session = await interviewsRepository.getInterviewById(id, userId);
    if (!session) {
      return null;
    }

    const currentSession = await activateInterviewIfReady(session);

    return mapInterviewSession({
      ...session,
      status: currentSession.status,
      startedAt: currentSession.startedAt
    });
  },

  async cancelScheduledInterview(userId: string, id: string) {
    const result = await interviewsRepository.cancelScheduledInterview(userId, id);

    if (result === null) {
      throw new ApiError(404, 'Scheduled interview was not found');
    }

    if (result === false) {
      throw new ApiError(
        409,
        'Only future scheduled interviews can be cancelled'
      );
    }

    await dashboardCacheService.invalidate(userId);
  }
};
