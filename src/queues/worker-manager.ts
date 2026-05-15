import { getRedis } from '@config/redis.js';
import { Worker } from 'bullmq';
import { logger } from '@/logging/logger.js';
import { requestContext } from '@shared/utils/request-context.js';
import type { JobProcessor, QueueName, WorkerConfig } from './types.js';
import { normalizeKeepJobsOption } from './manager.js';

export class WorkerManager {
  private workers = new Map<QueueName, Worker>();
  private jobHeartbeats = new Map<string, NodeJS.Timeout>();

  registerWorker(
    queueName: QueueName,
    processor: JobProcessor,
    config: WorkerConfig = {}
  ): void {
    if (this.workers.has(queueName)) {
      logger.warn(
        { queue: queueName },
        'Worker registration skipped because worker already exists'
      );
      throw new Error(`Worker for queue '${queueName}' is already registered`);
    }

    const concurrency = config.concurrency ?? 5;
    const lockDuration = config.lockDuration ?? 120000;
    logger.info(
      {
        queue: queueName,
        concurrency,
        lockDuration,
        limiter: config.limiter,
        removeOnComplete: normalizeKeepJobsOption(config.removeOnComplete, 50),
        removeOnFail: normalizeKeepJobsOption(config.removeOnFail, 500)
      },
      'Registering BullMQ worker'
    );

    const worker = new Worker(
      queueName,
      async (job) => {
        const requestId = job.data?._trace?.requestId || `worker-${job.id}`;
        const startedAt = Date.now();
        const heartbeatKey = `${queueName}:${job.id}`;

        this.clearJobHeartbeat(heartbeatKey);
        this.jobHeartbeats.set(
          heartbeatKey,
          setInterval(() => {
            logger.info(
              {
                jobId: job.id,
                queue: queueName,
                name: job.name,
                elapsedMs: Date.now() - startedAt,
                attemptsMade: job.attemptsMade,
                lockDuration
              },
              'Job still processing; BullMQ lock renewal should be active'
            );
          }, Math.max(15000, Math.floor(lockDuration / 2)))
        );

        return requestContext.run({ requestId }, async () => {
          logger.info(
            {
              jobId: job.id,
              queue: queueName,
              name: job.name,
              attempts: job.attemptsMade,
              lockDuration
            },
            'Starting job processing'
          );

          try {
            const result = await processor({
              id: job.id!,
              name: job.name,
              data: job.data,
              attemptsMade: job.attemptsMade,
              opts: {
                attempts: job.opts?.attempts ?? 1,
                delay: job.opts?.delay ?? 0
              }
            });

            if (!result.success && result.metadata?.retryable !== false) {
              throw new Error(result.error || 'Retryable job processing failed');
            }

            logger.info(
              {
                jobId: job.id,
                queue: queueName,
                name: job.name,
                result: result.success,
                elapsedMs: Date.now() - startedAt
              },
              'Job completed successfully'
            );

            return result;
          } catch (error) {
            logger.error(
              { jobId: job.id, queue: queueName, error },
              'Job processing failed'
            );
            throw error;
          } finally {
            this.clearJobHeartbeat(heartbeatKey);
          }
        });
      },
      {
        connection: getRedis(),
        concurrency,
        limiter: config.limiter,
        lockDuration,
        removeOnComplete: normalizeKeepJobsOption(config.removeOnComplete, 50),
        removeOnFail: normalizeKeepJobsOption(config.removeOnFail, 500)
      }
    );

    // Event handlers
    worker.on('ready', () => {
      logger.info({ queue: queueName }, 'Worker ready');
    });

    worker.on('active', (job) => {
      logger.info(
        { jobId: job?.id, queue: queueName, name: job?.name },
        'Worker marked job active'
      );
    });

    worker.on('completed', (job) => {
      this.clearJobHeartbeat(`${queueName}:${job?.id}`);
      logger.info(
        { jobId: job?.id, queue: queueName, name: job?.name },
        'Worker completed event received'
      );
    });

    worker.on('failed', (job, error) => {
      this.clearJobHeartbeat(`${queueName}:${job?.id}`);
      logger.error(
        {
          jobId: job?.id,
          queue: queueName,
          name: job?.name,
          attemptsMade: job?.attemptsMade,
          failedReason: job?.failedReason,
          error: error.message,
          stack: error.stack
        },
        'Worker failed event received'
      );
    });

    worker.on('stalled', (jobId) => {
      this.clearJobHeartbeat(`${queueName}:${jobId}`);
      logger.warn(
        { jobId, queue: queueName, lockDuration },
        'Worker stalled event received'
      );
    });

    worker.on('progress', (job, progress) => {
      logger.info(
        { jobId: job?.id, queue: queueName, name: job?.name, progress },
        'Worker progress event received'
      );
    });

    worker.on('drained', () => {
      logger.info({ queue: queueName }, 'Worker drained queue');
    });

    worker.on('error', (error) => {
      logger.error({ queue: queueName, error }, 'Worker error event received');
    });

    worker.on('closed', () => {
      logger.info({ queue: queueName }, 'Worker closed');
    });

    this.workers.set(queueName, worker);
  }

  getWorker(queueName: QueueName): Worker | undefined {
    return this.workers.get(queueName);
  }

  async stopWorker(queueName: QueueName): Promise<void> {
    const worker = this.workers.get(queueName);
    if (worker) {
      logger.info({ queue: queueName }, 'Closing worker');
      await worker.close();
      this.workers.delete(queueName);
    }
  }

  async stopAllWorkers(): Promise<void> {
    for (const interval of this.jobHeartbeats.values()) {
      clearInterval(interval);
    }
    this.jobHeartbeats.clear();

    const stopPromises = Array.from(this.workers.values()).map((worker) =>
      worker.close()
    );
    await Promise.allSettled(stopPromises);
    this.workers.clear();
  }

  getRegisteredQueues(): QueueName[] {
    return Array.from(this.workers.keys());
  }

  private clearJobHeartbeat(key: string) {
    const interval = this.jobHeartbeats.get(key);
    if (!interval) return;

    clearInterval(interval);
    this.jobHeartbeats.delete(key);
  }
}

// Global instance
export const workerManager = new WorkerManager();
