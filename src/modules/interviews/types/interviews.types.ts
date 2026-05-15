import { AiFeedbackType, InterviewStatus, ProcessingStatus } from '@prisma/client';

export interface InterviewQuestion {
  questionId: string;
  prompt: string;
  answer?: string;
}

export interface InterviewPerformanceMetrics {
  score?: number;
  passed?: boolean;
  grade?: 'excellent' | 'good' | 'average' | 'needs improvement';
  recommendation?: string;
}

export interface CreateInterviewSessionRequest {
  title: string;
  roleTarget: string;
  level?: string;
  questionCount?: number;
  scheduledAt?: string;
}

export interface SubmitInterviewAnswersRequest {
  answers: Array<{
    questionId: string;
    answer: string;
  }>;
  transcript?: string;
}

export interface InterviewFeedbackResponse {
  id: string;
  type: AiFeedbackType;
  provider: string;
  status: ProcessingStatus;
  score?: number;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
  questionFeedback?: Array<{
    questionId: string;
    score: number;
    whatWorked: string[];
    improve: string[];
    strongerAnswer: string;
  }>;
  createdAt: Date;
}

export interface InterviewSessionResponse {
  id: string;
  userId: string;
  title: string;
  roleTarget: string;
  level?: string;
  status: InterviewStatus;
  questions?: InterviewQuestion[];
  transcript?: unknown;
  score?: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  aiFeedbacks: InterviewFeedbackResponse[];
  performance?: InterviewPerformanceMetrics;
}

export interface GetInterviewsQuery {
  page?: number;
  limit?: number;
  status?: InterviewStatus;
  roleTarget?: string;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface GetInterviewSlotsQuery {
  date?: string;
  days?: number;
  roleTarget?: string;
  level?: string;
  timezoneOffsetMinutes?: number;
  now?: string;
}

export interface InterviewSlot {
  availabilityId?: string;
  startsAt: string;
  endsAt: string;
  label: string;
  available: boolean;
  capacity?: number;
  remainingCapacity?: number;
  roleTarget?: string;
  level?: string;
}
