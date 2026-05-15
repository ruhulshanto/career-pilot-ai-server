import { Queue } from 'bullmq';
import { logger } from '@/logging/logger.js';
import type { JobData, JobResult, KeepJobsConfig, QueueName } from './types.js';
import { createSafeJobId, getQueue, normalizeKeepJobsOption } from './manager.js';

export type JobOptions = {
  jobId?: string;
  delay?: number;
  priority?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  removeOnComplete?: KeepJobsConfig;
  removeOnFail?: KeepJobsConfig;
};

export class JobScheduler {
  static async addJob(
    queueName: QueueName,
    jobName: string,
    data: JobData,
    options: JobOptions = {}
  ): Promise<string> {
    const queue = getQueue(queueName);

    try {
      const job = await queue.add(jobName, data, {
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

      logger.info(
        { jobId: job.id, queue: queueName, name: jobName },
        'Job added to queue'
      );

      return job.id!;
    } catch (error) {
      logger.error(
        { queue: queueName, name: jobName, error },
        'Failed to add job to queue'
      );
      throw error;
    }
  }

  static async addBulkJobs(
    queueName: QueueName,
    jobs: Array<{
      name: string;
      data: JobData;
      options?: JobOptions;
    }>
  ): Promise<string[]> {
    const queue = getQueue(queueName);

    try {
      const bullJobs = jobs.map(({ name, data, options = {} }) => ({
        name,
        data,
        opts: {
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
        }
      }));

      const addedJobs = await queue.addBulk(bullJobs);

      const jobIds = addedJobs.map((job) => job.id!);

      logger.info(
        { queue: queueName, count: jobIds.length },
        'Bulk jobs added to queue'
      );

      return jobIds;
    } catch (error) {
      logger.error(
        { queue: queueName, count: jobs.length, error },
        'Failed to add bulk jobs to queue'
      );
      throw error;
    }
  }

  static async scheduleJob(
    queueName: QueueName,
    jobName: string,
    data: JobData,
    delayMs: number,
    options: Omit<JobOptions, 'delay'> = {}
  ): Promise<string> {
    return this.addJob(queueName, jobName, data, {
      ...options,
      delay: delayMs
    });
  }

  static async getJobStatus(
    queueName: QueueName,
    jobId: string
  ): Promise<{
    id: string;
    name: string;
    data: JobData;
    progress: number;
    attemptsMade: number;
    finishedOn?: number;
    processedOn?: number;
    failedReason?: string;
    returnvalue?: JobResult;
  } | null> {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) return null;

    return {
      id: job.id!,
      name: job.name,
      data: job.data,
      progress: typeof job.progress === 'number' ? job.progress : 0,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue
    };
  }

  static async retryJob(queueName: QueueName, jobId: string): Promise<void> {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();

    logger.info({ jobId, queue: queueName }, 'Job retry initiated');
  }

  static async removeJob(queueName: QueueName, jobId: string): Promise<void> {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.remove();

    logger.info({ jobId, queue: queueName }, 'Job removed');
  }
}
