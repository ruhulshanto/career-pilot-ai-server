import { logger } from '@/logging/logger.js';
import { getAllQueues, getQueue } from './manager.js';
import type { QueueName } from './types.js';

const queueNames: QueueName[] = [
  'resume-analysis',
  'ai-processing',
  'notifications',
  'analytics'
];

const cleanStates = ['active', 'stalled', 'delayed', 'failed', 'wait', 'waiting'] as const;

export const ensureQueuesInitialized = () => {
  queueNames.forEach((queueName) => getQueue(queueName));
};

export const cleanDevelopmentQueues = async (options: {
  obliterate?: boolean;
  failedGraceMs?: number;
  cleanLimit?: number;
} = {}) => {
  ensureQueuesInitialized();

  const obliterate =
    options.obliterate ?? process.env.QUEUE_OBLITERATE_ON_START === 'true';
  const failedGraceMs = options.failedGraceMs ?? 60 * 60 * 1000;
  const cleanLimit = options.cleanLimit ?? 1000;

  for (const queue of getAllQueues()) {
    if (obliterate) {
      await queue.obliterate({ force: true });
      logger.warn(
        { queue: queue.name },
        'Development queue obliterated before worker startup'
      );
      continue;
    }

    for (const state of cleanStates) {
      try {
        const grace = state === 'failed' ? failedGraceMs : 0;
        const cleaned = await queue.clean(grace, cleanLimit, state as any);
        logger.info(
          { queue: queue.name, state, cleaned: cleaned.length },
          'Development queue cleanup completed'
        );
      } catch (error) {
        logger.warn(
          { queue: queue.name, state, error },
          'Development queue cleanup skipped for state'
        );
      }
    }
  }
};

export const cleanQueuesForCli = async () => {
  await cleanDevelopmentQueues({ obliterate: true });
};
