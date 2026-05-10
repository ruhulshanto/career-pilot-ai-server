import { AiFeedbackType, ProcessingStatus } from '@prisma/client';

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
  createdAt: Date;
}

export interface InterviewSessionResponse {
  id: string;
  userId: string;
  title: string;
  roleTarget: string;
  level?: string;
  status: ProcessingStatus;
  questions?: InterviewQuestion[];
  transcript?: unknown;
  score?: number;
  createdAt: Date;
  updatedAt: Date;
  aiFeedbacks: InterviewFeedbackResponse[];
  performance?: InterviewPerformanceMetrics;
}

export interface GetInterviewsQuery {
  page?: number;
  limit?: number;
  status?: ProcessingStatus;
  roleTarget?: string;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}
