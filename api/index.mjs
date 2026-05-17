import { app } from '../dist/src/app/app.js';
import { connectPrismaWithRetry } from '../dist/src/config/prisma.js';
import { getRedis } from '../dist/src/config/redis.js';

let initialized = false;

const initializeDependencies = async () => {
  if (initialized) {
    return;
  }

  await connectPrismaWithRetry();
  await getRedis().ping();

  initialized = true;
};

try {
  await initializeDependencies();
} catch (error) {
  console.error('Backend initialization failed:', error);
  throw error;
}

export default app;
