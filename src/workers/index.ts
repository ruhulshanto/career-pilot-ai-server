import { workerManager } from '@queues/worker-manager.js';
import type { JobProcessor } from '@queues/types.js';

// Import job processors
import { resumeAnalysisProcessor } from './processors/resume-analysis.processor.js';
import { aiProcessingProcessor } from './processors/ai-processing.processor.js';
import { notificationProcessor } from './processors/notification.processor.js';
import { analyticsProcessor } from './processors/analytics.processor.js';

let workersInitialized = false;

export const initializeWorkers = (): void => {
  if (workersInitialized) {
    return;
  }

  // Register all workers
  workerManager.registerWorker('resume-analysis', resumeAnalysisProcessor, {
    concurrency: 3,
    lockDuration: 120000,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 500 }
  });

  workerManager.registerWorker('ai-processing', aiProcessingProcessor, {
    concurrency: 2,
    lockDuration: 180000,
    limiter: { max: 3, duration: 1000 }, // Keep provider requests bounded under slow AI responses
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 }
  });

  workerManager.registerWorker('notifications', notificationProcessor, {
    concurrency: 10,
    lockDuration: 60000,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 }
  });

  workerManager.registerWorker('analytics', analyticsProcessor, {
    concurrency: 2,
    lockDuration: 60000,
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 }
  });

  workersInitialized = true;
};

export const startWorkers = (): void => {
  initializeWorkers();
};

export const stopWorkers = async (): Promise<void> => {
  await workerManager.stopAllWorkers();
  workersInitialized = false;
};
