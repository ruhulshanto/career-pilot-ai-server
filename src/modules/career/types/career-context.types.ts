export type CareerContextResponse = {
  resume: {
    latestResumeId?: string;
    title?: string;
    atsScore?: number;
    inferredTargetRole?: string;
    experienceLevel?: string;
    missingSkills: string[];
    keywordGaps: string[];
    strengths: string[];
    improvementSuggestions: string[];
  };
  roadmap: {
    latestRoadmapId?: string;
    targetRole?: string;
    currentLevel?: string;
    progress?: number;
    activeMilestone?: string;
    nextMilestone?: string;
    skillsToBuild: string[];
  };
  interview: {
    latestSessionId?: string;
    latestScore?: number;
    scheduledAt?: Date;
    status?: string;
    weakestQuestions: string[];
    suggestedPracticeAreas: string[];
  };
  chatbot: {
    latestSessionId?: string;
    lastMessageAt?: Date;
    actionPlan: string[];
  };
  jobs: {
    jobMatches: Array<{
      title: string;
      company: string;
      matchScore: number;
    }>;
    applications: Array<{
      title: string;
      company: string;
      status: string;
    }>;
    goals: Array<{
      title: string;
      status: string;
      progress: number;
      nextSteps: string[];
    }>;
  };
  readiness: {
    resume: number;
    roadmap: number;
    interview: number;
    overall: number;
  };
  nextAction: {
    label: string;
    href: string;
    reason: string;
  };
};
