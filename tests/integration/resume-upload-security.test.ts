import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { ProcessingStatus } from '@prisma/client';

const resumeQueueAddMock = vi.fn();

vi.mock('@config/ai.js', () => ({
  CHATBOT_AI_PROVIDER: 'chatbot-groq',
  getChatbotGroqConfigurationStatus: vi.fn(() => ({ configured: true })),
  getConfiguredAiProvider: vi.fn(() => 'groq'),
  getConfiguredPrismaAiProvider: vi.fn(() => 'GROQ'),
  getDefaultAiModel: vi.fn((_task: string, options: { temperature: number; maxTokens?: number }) => ({
    provider: 'groq',
    model: 'test-model',
    temperature: options.temperature,
    maxTokens: options.maxTokens
  })),
  getGroqConfigurationStatus: vi.fn(() => ({ configured: true })),
  getRoadmapAiModel: vi.fn(() => ({
    provider: 'groq',
    model: 'test-model',
    temperature: 0.25,
    maxTokens: 4096
  })),
  isChatbotGroqConfigured: vi.fn(() => true),
  isGroqConfigured: vi.fn(() => true),
  logAiConfiguration: vi.fn()
}));

vi.mock('@queues/index.js', () => ({
  createSafeJobId: vi.fn((...parts: string[]) => parts.join(':')),
  getAiProcessingQueue: vi.fn(() => ({ add: vi.fn() })),
  getAnalyticsQueue: vi.fn(() => ({ add: vi.fn() })),
  getNotificationQueue: vi.fn(() => ({ add: vi.fn() })),
  getResumeAnalysisQueue: vi.fn(() => ({ add: resumeQueueAddMock }))
}));

import { app } from '@/app/app.js';
import { env } from '@config/env.js';
import { tokenService } from '@modules/auth/services/token.service.js';
import {
  RESUME_MAX_FILE_SIZE_BYTES,
  RESUME_PRIVATE_UPLOAD_DIR
} from '@modules/resumes/services/resume-text-extraction.service.js';
import { prismaMock } from '../mocks/prisma.mock.js';

const userId = 'test-user-id';
const token = tokenService.signAccessToken(userId, 'USER');
const uploadedFiles: string[] = [];

const mockAuthenticatedUser = () => {
  prismaMock.user.findFirst.mockResolvedValue({
    id: userId,
    role: 'USER'
  } as never);
};

const mockResumeCreate = () => {
  (prismaMock.resume.create as any).mockImplementation(({ data }: any) => {
    uploadedFiles.push(data.fileUrl);
    return Promise.resolve({
      id: 'resume-id',
      userId: data.userId,
      title: data.title,
      fileUrl: data.fileUrl,
      fileType: data.fileType,
      fileSize: data.fileSize,
      status: ProcessingStatus.PENDING,
      parsedText: null,
      createdAt: new Date('2026-05-15T00:00:00.000Z'),
      updatedAt: new Date('2026-05-15T00:00:00.000Z')
    } as any);
  });
};

const postUpload = (buffer: Buffer, filename: string, contentType: string) =>
  request(app)
    .post(`${env.API_PREFIX}/resume/analyze`)
    .set('Authorization', `Bearer ${token}`)
    .attach('resume', buffer, { filename, contentType });

beforeEach(() => {
  mockAuthenticatedUser();
  mockResumeCreate();
});

afterEach(async () => {
  for (const filePath of uploadedFiles.splice(0)) {
    await unlink(filePath).catch(() => undefined);
  }
  resumeQueueAddMock.mockClear();
});

describe('Resume upload security', () => {
  it.each([
    ['PDF', 'resume.pdf', 'application/pdf', Buffer.from('%PDF-1.4')],
    [
      'DOCX',
      'resume.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      Buffer.from('docx')
    ],
    ['TXT', 'resume.txt', 'text/plain', Buffer.from('resume text')]
  ])('accepts %s uploads and queues analysis', async (_label, filename, contentType, content) => {
    const response = await postUpload(content, filename, contentType);

    expect(response.status).toBe(202);
    expect(response.body.data.id).toBe('resume-id');
    expect(response.body.data.fileUrl).toBeUndefined();
    expect(resumeQueueAddMock).toHaveBeenCalledWith(
      'analyze-resume',
      { resumeId: 'resume-id', userId },
      expect.objectContaining({
        attempts: 3,
        jobId: expect.stringContaining('resume:analysis')
      })
    );

    const createdResume = prismaMock.resume.create.mock.calls.at(-1)?.[0].data;
    expect(createdResume?.fileUrl).toContain(RESUME_PRIVATE_UPLOAD_DIR);
    expect(path.extname(createdResume?.fileUrl ?? '')).toBe(
      path.extname(filename)
    );
  });

  it('rejects direct external URL resume submission', async () => {
    const response = await request(app)
      .post(`${env.API_PREFIX}/resume`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'SSRF attempt',
        fileUrl: 'http://169.254.169.254/latest/meta-data',
        fileType: 'application/pdf'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('must be uploaded directly');
    expect(prismaMock.resume.create).not.toHaveBeenCalled();
    expect(resumeQueueAddMock).not.toHaveBeenCalled();
  });

  it('rejects invalid file types with a safe message', async () => {
    const response = await postUpload(
      Buffer.from('not a resume'),
      'resume.png',
      'image/png'
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Upload a PDF, DOCX, or TXT resume');
    expect(prismaMock.resume.create).not.toHaveBeenCalled();
    expect(resumeQueueAddMock).not.toHaveBeenCalled();
  });

  it('rejects oversized resume files', async () => {
    const response = await postUpload(
      Buffer.alloc(RESUME_MAX_FILE_SIZE_BYTES + 1, 'a'),
      'resume.txt',
      'text/plain'
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Maximum supported size is 5 MB');
    expect(prismaMock.resume.create).not.toHaveBeenCalled();
    expect(resumeQueueAddMock).not.toHaveBeenCalled();
  });

  it('does not expose private resume uploads through the static uploads route', async () => {
    const response = await postUpload(
      Buffer.from('resume text'),
      'resume.txt',
      'text/plain'
    );
    expect(response.status).toBe(202);

    const createdResume = prismaMock.resume.create.mock.calls.at(-1)?.[0].data;
    const relativePath = path
      .relative(path.resolve(env.UPLOADS_DIR), createdResume?.fileUrl ?? '')
      .replace(/\\/g, '/');

    const staticResponse = await request(app).get(`/uploads/${relativePath}`);

    expect(staticResponse.status).toBe(404);
  });
});
