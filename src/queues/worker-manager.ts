import { getRedis } from '@config/redis.js';
import { Worker } from 'bullmq';
import { logger } from '@/logging/logger.js';
import { requestContext } from '@shared/utils/request-context.js';
import type { JobProcessor, QueueName, WorkerConfig } from './types.js';

export class WorkerManager {
  private workers = new Map<QueueName, Worker>();

  registerWorker(
    queueName: QueueName,
    processor: JobProcessor,
    config: WorkerConfig = {}
  ): void {
    if (this.workers.has(queueName)) {
      throw new Error(`Worker for queue '${queueName}' is already registered`);
    }

    const worker = new Worker(
      queueName,
      async (job) => {
        const requestId = job.data?._trace?.requestId || `worker-${job.id}`;

        return requestContext.run({ requestId }, async () => {
          logger.info(
            { jobId: job.id, queue: queueName, attempts: job.attemptsMade },
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

            logger.info(
              { jobId: job.id, queue: queueName, result: result.success },
              'Job completed successfully'
            );

            return result;
          } catch (error) {
            logger.error(
              { jobId: job.id, queue: queueName, error },
              'Job processing failed'
            );
            throw error;
          }
        });
      },
      {
        connection: getRedis(),
        concurrency: config.concurrency ?? 5,
        limiter: config.limiter,
        removeOnComplete: (config.removeOnComplete as any) ?? 50,
        removeOnFail: (config.removeOnFail as any) ?? 20
      }
    );

    // Event handlers
    worker.on('completed', (job) => {
      logger.info({ jobId: job?.id, queue: queueName }, 'Job completed');
    });

    worker.on('failed', (job, error) => {
      logger.error(
        { jobId: job?.id, queue: queueName, error: error.message },
        'Job failed permanently'
      );
    });

    worker.on('stalled', (jobId) => {
      logger.warn({ jobId, queue: queueName }, 'Job stalled');
    });

    this.workers.set(queueName, worker);
  }

  getWorker(queueName: QueueName): Worker | undefined {
    return this.workers.get(queueName);
  }

  async stopWorker(queueName: QueueName): Promise<void> {
    const worker = this.workers.get(queueName);
    if (worker) {
      await worker.close();
      this.workers.delete(queueName);
    }
  }

  async stopAllWorkers(): Promise<void> {
    const stopPromises = Array.from(this.workers.values()).map((worker) =>
      worker.close()
    );
    await Promise.allSettled(stopPromises);
    this.workers.clear();
  }

  getRegisteredQueues(): QueueName[] {
    return Array.from(this.workers.keys());
  }
}

// Global instance
export const workerManager = new WorkerManager();
