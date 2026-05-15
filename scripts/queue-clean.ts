import { disconnectRedis } from '../src/config/redis.js';
import { cleanQueuesForCli } from '../src/queues/maintenance.js';
import { closeAllQueues } from '../src/queues/manager.js';
import { logger } from '../src/logging/logger.js';

try {
  await cleanQueuesForCli();
  await closeAllQueues();
  disconnectRedis();
  logger.info('BullMQ development queues cleaned');
  process.exit(0);
} catch (error) {
  logger.error({ error }, 'Failed to clean BullMQ development queues');
  await closeAllQueues();
  disconnectRedis();
  process.exit(1);
}
