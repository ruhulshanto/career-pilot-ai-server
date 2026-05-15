export type QueueName =
  | 'resume-analysis'
  | 'ai-processing'
  | 'notifications'
  | 'analytics';

export type JobData = Record<string, unknown>;

export type JobResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type KeepJobsOption =
  {
    age: number;
    count?: number;
    limit?: number;
  };

export type KeepJobsConfig =
  | number
  | boolean
  | KeepJobsOption
  | {
      age?: number;
      count?: number;
      limit?: number;
    };

export type JobProcessor<TData = JobData, TResult = JobResult> = (job: {
  id: string;
  name: string;
  data: TData;
  attemptsMade: number;
  opts: {
    attempts: number;
    delay: number;
  };
}) => Promise<TResult>;

export type WorkerConfig = {
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
  lockDuration?: number;
  removeOnComplete?: KeepJobsConfig;
  removeOnFail?: KeepJobsConfig;
};
