import {
  getChatbotGroqConfigurationStatus,
  getGroqConfigurationStatus
} from '@config/ai.js';
import { env, getEnvironmentDiagnostics } from '@config/env.js';
import { prisma } from '@config/prisma.js';
import { getRedis, isRedisReady } from '@config/redis.js';
import {
  getAiProcessingQueue,
  getAnalyticsQueue,
  getNotificationQueue,
  getResumeAnalysisQueue
} from '@queues/index.js';
import type { QueueName } from '@queues/types.js';
import { getStorageHealth } from '@shared/storage/file-storage.service.js';
import { logger } from '@/logging/logger.js';

type ComponentStatus = 'online' | 'degraded' | 'offline';
type QueueHealth = {
  name: QueueName;
  status: ComponentStatus;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  retryCount: number;
  stuck: number;
  healthy: boolean;
  recentFailures: Array<{
    id: string;
    name: string;
    attemptsMade: number;
    failedReason?: string;
    timestamp: number;
    processedOn?: number;
    finishedOn?: number;
  }>;
  message?: string;
};

type QueueConfig = {
  name: QueueName;
  getQueue: ReturnType<typeof createQueueGetter>;
};

const createQueueGetter =
  (getter: () => ReturnType<typeof getResumeAnalysisQueue>) => getter;

const queues = [
  { name: 'resume-analysis', getQueue: createQueueGetter(getResumeAnalysisQueue) },
  { name: 'ai-processing', getQueue: createQueueGetter(getAiProcessingQueue) },
  { name: 'notifications', getQueue: createQueueGetter(getNotificationQueue) },
  { name: 'analytics', getQueue: createQueueGetter(getAnalyticsQueue) }
] satisfies QueueConfig[];

const startedAt = new Date();
const STUCK_JOB_MS = 15 * 60 * 1000;

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);

const summarizeStatus = (statuses: ComponentStatus[]): ComponentStatus => {
  if (statuses.some((status) => status === 'offline')) return 'offline';
  if (statuses.some((status) => status === 'degraded')) return 'degraded';
  return 'online';
};

const summarizeSystemStatus = ({
  required,
  diagnostics
}: {
  required: ComponentStatus[];
  diagnostics: ComponentStatus[];
}): ComponentStatus => {
  if (required.some((status) => status === 'offline')) return 'offline';
  if ([...required, ...diagnostics].some((status) => status !== 'online')) {
    return 'degraded';
  }

  return 'online';
};

const isProduction = () => env.NODE_ENV === 'production';

const getDatabaseHealth = async () => {
  const started = Date.now();

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 1500, 'Database health check');

    const schemaChecks = await prisma.$queryRaw<Array<{ check_name: string; exists: boolean }>>`
      SELECT 'account_sessions_table' AS check_name, to_regclass('public.account_sessions') IS NOT NULL AS exists
      UNION ALL
      SELECT 'refresh_tokens_sessionId_column' AS check_name,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'refresh_tokens' AND column_name = 'sessionId'
        ) AS exists
      UNION ALL
      SELECT 'users_isDemo_column' AS check_name,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'isDemo'
        ) AS exists
      UNION ALL
      SELECT 'users_mentorSpecialties_column' AS check_name,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'mentorSpecialties'
        ) AS exists
    `;

    if (!Array.isArray(schemaChecks)) {
      return {
        status: 'degraded' as const,
        latencyMs: Date.now() - started,
        schema: {
          status: 'degraded' as const,
          missing: ['schema_check_unavailable']
        }
      };
    }

    const missing = schemaChecks
      .filter((check) => !check.exists)
      .map((check) => check.check_name);

    return {
      status: missing.length ? ('degraded' as const) : ('online' as const),
      latencyMs: Date.now() - started,
      schema: {
        status: missing.length ? ('degraded' as const) : ('online' as const),
        missing
      }
    };
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return {
      status: 'offline' as const,
      latencyMs: Date.now() - started,
      schema: {
        status: 'offline' as const,
        missing: ['database_unreachable']
      }
    };
  }
};

const getRedisHealth = async () => {
  const started = Date.now();

  try {
    const redis = getRedis();

    if (typeof redis.ping !== 'function') {
      return {
        status: isProduction() ? ('offline' as const) : ('degraded' as const),
        latencyMs: Date.now() - started,
        message: 'Redis client does not expose a ping health check'
      };
    }

    const pong = await withTimeout(redis.ping(), 1500, 'Redis health check');

    return {
      status: pong === 'PONG' && isRedisReady() ? ('online' as const) : ('degraded' as const),
      latencyMs: Date.now() - started
    };
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return {
      status: 'offline' as const,
      latencyMs: Date.now() - started
    };
  }
};

export const getQueueHealth = async () => {
  const results = await Promise.allSettled(
    queues.map(async ({ name, getQueue }) => {
      const queue = getQueue();

      if (
        typeof queue.getJobCounts !== 'function' ||
        typeof queue.getJobs !== 'function'
      ) {
        throw new Error('Queue client does not expose health inspection methods');
      }

      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused'
      );
      const failedJobs = await queue.getJobs(['failed'], 0, 4);
      const activeJobs = await queue.getJobs(['active'], 0, 19);
      const now = Date.now();
      const stuckJobs = activeJobs.filter((job) => {
        const started = job.processedOn ?? 0;
        return started > 0 && now - started > STUCK_JOB_MS;
      });
      const retryCount = failedJobs.reduce(
        (total, job) => total + Math.max(job.attemptsMade - 1, 0),
        0
      );

      const status =
        (counts.failed ?? 0) === 0 && stuckJobs.length === 0
          ? ('online' as const)
          : ('degraded' as const);

      return {
        name,
        status,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
        paused: counts.paused ?? 0,
        retryCount,
        stuck: stuckJobs.length,
        healthy: status === 'online',
        recentFailures: failedJobs.map((job) => ({
          id: String(job.id),
          name: job.name,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn
        }))
      } satisfies QueueHealth;
    })
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;

    logger.warn(
      { err: result.reason, queue: queues[index].name },
      'Queue health check failed'
    );

    return {
      name: queues[index].name,
      status: isProduction() ? ('offline' as const) : ('degraded' as const),
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      retryCount: 0,
      stuck: 0,
      healthy: false,
      recentFailures: [],
      message:
        result.reason instanceof Error
          ? result.reason.message
          : 'Queue health check failed'
    } satisfies QueueHealth;
  });
};

const getAiHealth = () => {
  const groq = getGroqConfigurationStatus();
  const chatbotGroq = getChatbotGroqConfigurationStatus();

  return {
    status:
      groq.configured && chatbotGroq.configured
        ? ('online' as const)
        : groq.keyPresent || chatbotGroq.keyPresent
          ? ('degraded' as const)
          : ('offline' as const),
    providers: {
      groq,
      chatbotGroq
    }
  };
};

const getEmailHealth = () => {
  const smtpPassLooksPlaceholder = /google_app_password|placeholder|changeme|your_/i.test(
    env.SMTP_PASS ?? ''
  );
  const configured =
    Boolean(env.EMAIL_FROM) &&
    Boolean(env.SMTP_HOST) &&
    Boolean(env.SMTP_USER) &&
    Boolean(env.SMTP_PASS) &&
    !smtpPassLooksPlaceholder;

  return {
    provider: env.EMAIL_PROVIDER,
    status: configured ? ('online' as const) : ('degraded' as const),
    configured,
    fromConfigured: Boolean(env.EMAIL_FROM),
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    userConfigured: Boolean(env.SMTP_USER),
    passwordConfigured: Boolean(env.SMTP_PASS),
    passwordLooksPlaceholder: smtpPassLooksPlaceholder,
    message: configured
      ? 'Gmail SMTP provider is configured'
      : 'Gmail SMTP provider is not fully configured'
  };
};

export const systemHealthService = {
  async getSystemStatus(options: { includeDetails?: boolean } = {}) {
    const [database, redis, queueHealth, storage] = await Promise.all([
      getDatabaseHealth(),
      getRedisHealth(),
      getQueueHealth(),
      getStorageHealth()
    ]);
    const ai = getAiHealth();
    const email = getEmailHealth();
    const failedJobs = queueHealth.reduce((total, queue) => total + queue.failed, 0);
    const stuckJobs = queueHealth.reduce((total, queue) => total + queue.stuck, 0);
    const queueStatus = summarizeStatus([
      redis.status === 'offline' ? 'offline' : redis.status,
      ...queueHealth.map((queue) => queue.status)
    ]);
    const requiredServices = isProduction()
      ? (['database', 'redis', 'queues'] as const)
      : (['database'] as const);
    const requiredStatuses = isProduction()
      ? [database.status, redis.status, queueStatus]
      : [database.status];
    const diagnosticStatuses = isProduction()
      ? [ai.status, storage.status, email.status]
      : [redis.status, queueStatus, ai.status, storage.status, email.status];
    const status = summarizeSystemStatus({
      required: requiredStatuses,
      diagnostics: diagnosticStatuses
    });

    return {
      status,
      readiness: status === 'online' ? 'healthy' : status === 'degraded' ? 'degraded' : 'unhealthy',
      requiredServices,
      uptimeSeconds: Math.floor(process.uptime()),
      startedAt: startedAt.toISOString(),
      timestamp: new Date().toISOString(),
      components: {
        database,
        redis,
        queues: {
          status: queueStatus,
          failedJobs,
          stuckJobs,
          queueHealth: options.includeDetails
            ? queueHealth
            : queueHealth.map(({ recentFailures: _recentFailures, ...queue }) => queue)
        },
        ai,
        storage,
        email
      },
      environment: getEnvironmentDiagnostics()
    };
  },

  async retryFailedJobs(queueName: QueueName, limit = 10) {
    const queueConfig = queues.find((queue) => queue.name === queueName);
    if (!queueConfig) {
      return { retried: 0, queueName, errors: [`Unknown queue: ${queueName}`] };
    }

    const jobs = await queueConfig.getQueue().getJobs(['failed'], 0, Math.max(limit - 1, 0));
    const results = await Promise.allSettled(jobs.map((job) => job.retry()));

    return {
      retried: results.filter((result) => result.status === 'fulfilled').length,
      queueName,
      errors: results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason))
    };
  }
};
