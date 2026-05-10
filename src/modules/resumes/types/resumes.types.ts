import { ProcessingStatus, AiFeedbackType } from '@prisma/client';

export interface CreateResumeRequest {
  title: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
}

export interface ResumeResponse {
  id: string;
  userId: string;
  title: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
  status: ProcessingStatus;
  parsedText?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResumeWithFeedback extends ResumeResponse {
  aiFeedbacks: AiFeedbackResponse[];
}

export interface AiFeedbackResponse {
  id: string;
  type: AiFeedbackType;
  provider: string;
  status: ProcessingStatus;
  score?: number;
  summary?: string;
  strengths?: any;
  weaknesses?: any;
  suggestions?: any;
  createdAt: Date;
}

export interface GetResumesQuery {
  page?: number;
  limit?: number;
  status?: ProcessingStatus;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}
