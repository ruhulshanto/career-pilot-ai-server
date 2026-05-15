import { logger } from '@/logging/logger.js';
import { getNotificationQueue } from './manager.js';

let recurringJobsScheduled = false;

export const scheduleRecurringNotificationJobs = async () => {
  if (recurringJobsScheduled) return;

  const queue = getNotificationQueue();
  const jobs = [
    {
      name: 'scan-interview-reminders',
      every: 15 * 60 * 1000
    },
    {
      name: 'scan-roadmap-reminders',
      every: 6 * 60 * 60 * 1000
    },
    {
      name: 'scan-interview-feedback',
      every: 30 * 60 * 1000
    },
    {
      name: 'scan-low-readiness',
      every: 12 * 60 * 60 * 1000
    },
    {
      name: 'weekly-mentoring-reminders',
      every: 7 * 24 * 60 * 60 * 1000
    }
  ];

  await Promise.all(
    jobs.map((job) =>
      queue.add(
        job.name,
        { event: job.name, data: {} },
        {
          jobId: job.name,
          repeat: { every: job.every },
          removeOnComplete: { count: 25 },
          removeOnFail: { count: 50 }
        }
      )
    )
  );

  recurringJobsScheduled = true;
  logger.info({ count: jobs.length }, 'Recurring notification jobs scheduled');
};
