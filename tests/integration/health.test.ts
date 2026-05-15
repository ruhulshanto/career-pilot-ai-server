import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const healthMocks = vi.hoisted(() => {
  const queue = {
    add: vi.fn(),
    getJobCounts: vi.fn(),
    getJobs: vi.fn()
  };

  return {
    redisPing: vi.fn(),
    isRedisReady: vi.fn(),
    queue,
    addJobWithContext: vi.fn(),
    getGroqConfigurationStatus: vi.fn(),
    getChatbotGroqConfigurationStatus: vi.fn()
  };
});

vi.mock('@config/redis.js', () => ({
  isRedisReady: healthMocks.isRedisReady,
  getRedis: vi.fn(() => ({
    ping: healthMocks.redisPing,
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    publish: vi.fn(),
    subscribe: vi.fn(),
    duplicate: vi.fn(() => ({
      subscribe: vi.fn(),
      on: vi.fn(),
      disconnect: vi.fn()
    }))
  })),
  disconnectRedis: vi.fn()
}));

vi.mock('@queues/index.js', () => ({
  addJobWithContext: healthMocks.addJobWithContext,
  createSafeJobId: vi.fn((...parts: string[]) => parts.join(':')),
  getAiProcessingQueue: vi.fn(() => healthMocks.queue),
  getAnalyticsQueue: vi.fn(() => healthMocks.queue),
  getNotificationQueue: vi.fn(() => healthMocks.queue),
  getResumeAnalysisQueue: vi.fn(() => healthMocks.queue)
}));

vi.mock('@config/ai.js', () => ({
  CHATBOT_AI_PROVIDER: 'chatbot-groq',
  getChatbotGroqConfigurationStatus: healthMocks.getChatbotGroqConfigurationStatus,
  getConfiguredAiProvider: vi.fn(() => 'groq'),
  getConfiguredPrismaAiProvider: vi.fn(() => 'GROQ'),
  getDefaultAiModel: vi.fn((_task: string, options: { temperature: number; maxTokens?: number }) => ({
    provider: 'groq',
    model: 'test-model',
    temperature: options.temperature,
    maxTokens: options.maxTokens
  })),
  getGroqConfigurationStatus: healthMocks.getGroqConfigurationStatus,
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

import { app } from '@/app/app.js';
import { env } from '@config/env.js';
import { prismaMock } from '../mocks/prisma.mock.js';

const schemaChecks = [
  { check_name: 'account_sessions_table', exists: true },
  { check_name: 'refresh_tokens_sessionId_column', exists: true },
  { check_name: 'users_isDemo_column', exists: true },
  { check_name: 'users_mentorSpecialties_column', exists: true }
];

const mockHealthyDatabase = () => {
  prismaMock.$queryRaw
    .mockResolvedValueOnce([{ ok: 1 }] as never)
    .mockResolvedValueOnce(schemaChecks as never);
};

const mockHealthyDiagnostics = () => {
  env.EMAIL_FROM = 'Career Pilot AI <onboarding@example.com>';
  env.SMTP_HOST = 'smtp.gmail.com';
  env.SMTP_PORT = 465;
  env.SMTP_SECURE = true;
  env.SMTP_USER = 'careerpilot@example.com';
  env.SMTP_PASS = 'smtp_app_password_for_tests';

  healthMocks.redisPing.mockResolvedValue('PONG');
  healthMocks.isRedisReady.mockReturnValue(true);
  healthMocks.queue.getJobCounts.mockResolvedValue({
    waiting: 0,
    active: 0,
    completed: 12,
    failed: 0,
    delayed: 0,
    paused: 0
  });
  healthMocks.queue.getJobs.mockResolvedValue([]);
  healthMocks.getGroqConfigurationStatus.mockReturnValue({
    configured: true,
    keyPresent: true,
    keyPrefixOk: true,
    keyLength: 24,
    keyLooksPlaceholder: false
  });
  healthMocks.getChatbotGroqConfigurationStatus.mockReturnValue({
    configured: true,
    keyPresent: true,
    keyPrefixOk: true,
    keyLength: 24,
    keyLooksPlaceholder: false
  });
};

describe('Health Check Integration', () => {
  beforeEach(() => {
    mockHealthyDiagnostics();
  });

  it('returns 200 with a healthy structured response when core and diagnostic dependencies are healthy', async () => {
    mockHealthyDatabase();

    const response = await request(app).get(`${env.API_PREFIX}/health`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Career platform API is healthy',
      data: {
        status: 'online',
        readiness: 'healthy',
        uptimeSeconds: expect.any(Number),
        environment: {
          nodeEnv: expect.any(String)
        },
        components: {
          database: { status: 'online' },
          redis: { status: 'online' },
          queues: { status: 'online' },
          ai: { status: 'online' },
          email: { status: 'online' },
          storage: expect.objectContaining({
            status: expect.any(String)
          })
        }
      }
    });
  });

  it('returns 200 degraded when an optional non-production dependency is unavailable', async () => {
    mockHealthyDatabase();
    healthMocks.redisPing.mockRejectedValue(new Error('Redis unavailable in local test'));

    const response = await request(app).get(`${env.API_PREFIX}/health`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Career platform API is degraded',
      data: {
        status: 'degraded',
        readiness: 'degraded',
        components: {
          database: { status: 'online' },
          redis: { status: 'offline' }
        }
      }
    });
  });

  it('returns 503 when a required core dependency fails', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('Database unavailable') as never);

    const response = await request(app).get(`${env.API_PREFIX}/health`);

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Career platform API is unhealthy',
      data: {
        status: 'offline',
        readiness: 'unhealthy',
        components: {
          database: { status: 'offline' }
        }
      }
    });
  });
});
