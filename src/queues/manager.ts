import { getRedis } from '@config/redis.js';
import { Queue, QueueOptions } from 'bullmq';
import { getRequestId } from '@shared/utils/request-context.js';
import type { QueueName } from './types.js';

const queueConfigs: Record<QueueName, Omit<QueueOptions, 'connection'>> = {
  'resume-analysis': {
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 20,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    }
  },
  'ai-processing': {
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 10,
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 }
    }
  },
  notifications: {
    defaultJobOptions: {
      removeOnComplete: 1000,
      removeOnFail: 50,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 }
    }
  },
  analytics: {
    defaultJobOptions: {
      removeOnComplete: 200,
      removeOnFail: 20,
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
export const addJobWithContext = async (queueName: QueueName, jobName: string, data: any) => {
  const queue = getQueue(queueName);
  return queue.add(jobName, {
    ...data,
    _trace: { requestId: getRequestId() }
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
