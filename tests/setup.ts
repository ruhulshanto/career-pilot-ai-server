import { vi, beforeEach } from 'vitest';

// Mock Redis
vi.mock('@config/redis.js', () => ({
  getRedis: vi.fn(() => ({
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
      disconnect: vi.fn(),
    })),
  })),
  disconnectRedis: vi.fn(),
}));

// Mock BullMQ Queues
vi.mock('@queues/index.js', () => ({
  getAiProcessingQueue: vi.fn(() => ({ add: vi.fn() })),
  getAnalyticsQueue: vi.fn(() => ({ add: vi.fn() })),
  getNotificationQueue: vi.fn(() => ({ add: vi.fn() })),
  getResumeAnalysisQueue: vi.fn(() => ({ add: vi.fn() })),
}));

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
