import { adminRepository } from '@modules/admin/repositories/admin.repository.js';
import { systemHealthService } from '@/system/system-health.service.js';
import type { QueueName } from '@queues/types.js';

export const adminService = {
  async getDashboard() {
    const [
      cards,
      aiUsage,
      trends,
      newestUsers,
      recentFailures,
      recentAiJobs,
      recentNotifications,
      system
    ] = await Promise.all([
      adminRepository.getPlatformCounts(),
      adminRepository.getAiUsage(),
      adminRepository.getTrendSeries(),
      adminRepository.getNewestUsers(),
      adminRepository.getRecentFailures(),
      adminRepository.getRecentAiJobs(),
      adminRepository.getRecentNotifications(),
      systemHealthService.getSystemStatus({ includeDetails: true })
    ]);

    return {
      cards,
      aiUsage,
      charts: { trends },
      tables: {
        newestUsers,
        recentFailures,
        recentAiJobs,
        recentNotifications
      },
      monitoring: {
        redis: system.components.redis,
        database: system.components.database,
        queueHealth: system.components.queues.queueHealth,
        failedJobs: system.components.queues.failedJobs,
        stuckJobs: system.components.queues.stuckJobs,
        ai: system.components.ai,
        storage: system.components.storage,
        environment: system.environment,
        uptimeSeconds: system.uptimeSeconds,
        systemStatus: system.status
      },
      generatedAt: new Date().toISOString()
    };
  },

  async getSystem() {
    return systemHealthService.getSystemStatus({ includeDetails: true });
  },

  async retryFailedJobs(queueName: QueueName, limit?: number) {
    return systemHealthService.retryFailedJobs(queueName, limit);
  }
};
