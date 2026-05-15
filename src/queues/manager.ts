import { getRedis } from '@config/redis.js';
import { Queue, QueueOptions } from 'bullmq';
import { getRequestId } from '@shared/utils/request-context.js';
import type { KeepJobsConfig, KeepJobsOption, QueueName } from './types.js';
import type { JobOptions } from './job-scheduler.js';

const DEFAULT_KEEP_JOBS_AGE_SECONDS = 30 * 24 * 60 * 60;

export const keepJobsByCount = (count: number): KeepJobsOption => ({
  age: DEFAULT_KEEP_JOBS_AGE_SECONDS,
  count
});

export const createSafeJobId = (
  ...parts: Array<string | number | null | undefined>
) =>
  parts
    .filter((part): part is string | number => part !== null && part !== undefined)
    .map((part) => String(part).replace(/[^a-zA-Z0-9_-]/g, '-'))
    .join('__');

export const normalizeKeepJobsOption = (
  value: KeepJobsConfig | undefined,
  fallbackCount: number
): KeepJobsOption => {
  if (typeof value === 'number') return keepJobsByCount(value);
  if (typeof value === 'boolean') {
    return keepJobsByCount(value ? fallbackCount : 0);
  }
  if (value) {
    return {
      age: value.age ?? DEFAULT_KEEP_JOBS_AGE_SECONDS,
      count: value.count,
      limit: value.limit
    };
  }

  return keepJobsByCount(fallbackCount);
};

const queueConfigs: Record<QueueName, Omit<QueueOptions, 'connection'>> = {
  'resume-analysis': {
    defaultJobOptions: {
      removeOnComplete: keepJobsByCount(50),
      removeOnFail: keepJobsByCount(20),
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    }
  },
  'ai-processing': {
    defaultJobOptions: {
      removeOnComplete: keepJobsByCount(100),
      removeOnFail: keepJobsByCount(500),
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 }
    }
  },
  notifications: {
    defaultJobOptions: {
      removeOnComplete: keepJobsByCount(1000),
      removeOnFail: keepJobsByCount(50),
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 }
    }
  },
  analytics: {
    defaultJobOptions: {
      removeOnComplete: keepJobsByCount(200),
      removeOnFail: keepJobsByCount(20),
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 }
    }
  }
};

const queues = new Map<QueueName, Queue>();

export const getQueue = (name: QueueName): Queue => {
  if (!queues.has(name)) {
    const queue = new Queue(name, {
      connection: getRedis(),
      ...queueConfigs[name]
    });
    queues.set(name, queue);
  }
  return queues.get(name)!;
};

/**
 * Add a job to the queue while preserving the request context (tracing)
 */
export const addJobWithContext = async (
  queueName: QueueName,
  jobName: string,
  data: any,
  options: JobOptions = {}
) => {
  const queue = getQueue(queueName);
  return queue.add(jobName, {
    ...data,
    _trace: { requestId: getRequestId() }
  }, {
    jobId: options.jobId ? createSafeJobId(options.jobId) : undefined,
    delay: options.delay,
    priority: options.priority,
    attempts: options.attempts,
    backoff: options.backoff,
    removeOnComplete:
      options.removeOnComplete === undefined
        ? undefined
        : normalizeKeepJobsOption(options.removeOnComplete, 100),
    removeOnFail:
      options.removeOnFail === undefined
        ? undefined
        : normalizeKeepJobsOption(options.removeOnFail, 500)
  });
};

export const getResumeAnalysisQueue = () => getQueue('resume-analysis');
export const getAiProcessingQueue = () => getQueue('ai-processing');
export const getNotificationQueue = () => getQueue('notifications');
export const getAnalyticsQueue = () => getQueue('analytics');

export const getAllQueues = (): Queue[] => Array.from(queues.values());

export const closeAllQueues = async (): Promise<void> => {
  const closePromises = Array.from(queues.values()).map((queue) => queue.close());
  await Promise.allSettled(closePromises);
  queues.clear();
};
