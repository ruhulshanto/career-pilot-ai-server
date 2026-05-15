export const onboardingStepIds = [
  'UPLOAD_RESUME',
  'GENERATE_ROADMAP',
  'TAKE_INTERVIEW',
  'VIEW_JOB_MATCHES',
  'CREATE_CAREER_GOAL'
] as const;

export type OnboardingStepId = (typeof onboardingStepIds)[number];

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  actionLabel: string;
  actionLink: string;
  completed: boolean;
};

export type OnboardingProgressResponse = {
  isComplete: boolean;
  isSkipped: boolean;
  currentStep?: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  nextAction?: OnboardingStep;
  steps: OnboardingStep[];
  progressPercent: number;
  completedAt?: string;
  skippedAt?: string;
};
