import { workerManager } from '@queues/worker-manager.js';
import type { JobProcessor } from '@queues/types.js';

// Import job processors
import { resumeAnalysisProcessor } from './processors/resume-analysis.processor.js';
import { aiProcessingProcessor } from './processors/ai-processing.processor.js';
import { notificationProcessor } from './processors/notification.processor.js';
import { analyticsProcessor } from './processors/analytics.processor.js';

export const initializeWorkers = (): void => {
  // Register all workers
  workerManager.registerWorker('resume-analysis', resumeAnalysisProcessor, {
    concurrency: 3,
    removeOnComplete: 50,
    removeOnFail: 20
  });

  workerManager.registerWorker('ai-processing', aiProcessingProcessor, {
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }, // Rate limit AI calls
    removeOnComplete: 100,
    removeOnFail: 10
  });

  workerManager.registerWorker('notifications', notificationProcessor, {
    concurrency: 10,
    removeOnComplete: 1000,
    removeOnFail: 50
  });

  workerManager.registerWorker('analytics', analyticsProcessor, {
    concurrency: 2,
    removeOnComplete: 200,
    removeOnFail: 20
  });
};

export const startWorkers = (): void => {
  initializeWorkers();
};

export const stopWorkers = async (): Promise<void> => {
  await workerManager.stopAllWorkers();
};
