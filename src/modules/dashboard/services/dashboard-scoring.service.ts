import type {
  DashboardRawData,
  DashboardSkillGap
} from '../types/dashboard.types.js';

type WeightedSignal = {
  value: number;
  weight: number;
  available: boolean;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const average = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const numericProgress = (value: unknown): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value <= 1 ? value * 100 : value;
};

const roadmapProgressFromMilestones = (milestones: unknown): number => {
  const items = asArray(milestones);
  const scores = items
    .map((item) => {
      if (!isRecord(item)) return null;
      if (typeof item.progress === 'number') return numericProgress(item.progress);
      if (item.status === 'completed') return 100;
      if (item.status === 'in-progress') return 50;
      return 0;
    })
    .filter((value): value is number => value !== null);

  return clampScore(average(scores));
};

const skillCoverageFromRoadmap = (skills: unknown): number => {
  const items = asArray(skills);
  const scores = items
    .map((item) => {
      if (!isRecord(item)) return null;
      return numericProgress(item.progress);
    })
    .filter((value): value is number => value !== null);

  return clampScore(average(scores));
};

const aiRecommendationScore = (data: DashboardRawData): number => {
  if (typeof data.latestResumeFeedback?.score === 'number') {
    return clampScore(data.latestResumeFeedback.score);
  }

  const completedFeedbacks = data.recentAiFeedbacks.filter(
    (feedback) => feedback.status === 'COMPLETED' && !feedback.resumeId
  );

  if (!completedFeedbacks.length) return 0;

  const scored = completedFeedbacks
    .map((feedback) => feedback.score)
    .filter((score): score is number => typeof score === 'number');

  if (scored.length) return clampScore(average(scored));

  const failedCount = data.recentAiFeedbacks.filter(
    (feedback) => feedback.status === 'FAILED'
  ).length;
  return clampScore((completedFeedbacks.length / data.recentAiFeedbacks.length) * 100 - failedCount * 5);
};

const weightedScore = (signals: WeightedSignal[]) => {
  const available = signals.filter((signal) => signal.available);
  if (!available.length) return 0;

  const totalWeight = available.reduce((total, signal) => total + signal.weight, 0);
  const total = available.reduce(
    (sum, signal) => sum + clampScore(signal.value) * signal.weight,
    0
  );

  return clampScore(total / totalWeight);
};

const textItems = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (isRecord(item) && typeof item.text === 'string') return item.text;
        if (isRecord(item) && typeof item.title === 'string') return item.title;
        return null;
      })
      .filter((item): item is string => Boolean(item));
  }

  if (isRecord(value)) {
    return Object.values(value).flatMap(textItems);
  }

  return [];
};

export const dashboardScoringService = {
  getRoadmapProgress(data: DashboardRawData) {
    return roadmapProgressFromMilestones(data.latestRoadmap?.milestones);
  },

  getSkillCoverage(data: DashboardRawData) {
    return skillCoverageFromRoadmap(data.latestRoadmap?.skills);
  },

  getCareerReadiness(data: DashboardRawData) {
    const resumeScore = data.latestResumeFeedbackScore ?? 0;
    const interviewAverage = data.interviewAverage ?? 0;
    const roadmapProgress = this.getRoadmapProgress(data);
    const skillCoverage = this.getSkillCoverage(data);
    const aiScore = aiRecommendationScore(data);

    return weightedScore([
      {
        value: resumeScore,
        weight: 0.3,
        available: data.latestResumeFeedbackScore !== null
      },
      {
        value: interviewAverage,
        weight: 0.25,
        available: data.completedInterviewCount > 0 && data.interviewAverage !== null
      },
      {
        value: roadmapProgress,
        weight: 0.2,
        available: Boolean(data.latestRoadmap)
      },
      {
        value: skillCoverage,
        weight: 0.15,
        available: asArray(data.latestRoadmap?.skills).length > 0
      },
      {
        value: aiScore,
        weight: 0.1,
        available: data.recentAiFeedbacks.length > 0
      }
    ]);
  },

  getTopSkillGaps(data: DashboardRawData): DashboardSkillGap[] {
    const latestFeedback = data.latestResumeFeedback;
    const rawResponse = isRecord(latestFeedback?.rawResponse)
      ? latestFeedback.rawResponse
      : {};
    const latestResumeSkillSignals = [
      ...textItems(rawResponse.missingSkills),
      ...textItems(rawResponse.keywordGaps),
      ...textItems(latestFeedback?.weaknesses),
      ...textItems(latestFeedback?.suggestions)
    ];
    const seen = new Set<string>();
    const aiGaps = latestResumeSkillSignals
      .filter((item) => {
        const key = item.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(
        (item): DashboardSkillGap => ({
          skill: item,
          gapScore:
            latestFeedback?.score === null || latestFeedback?.score === undefined
              ? 50
              : clampScore(100 - latestFeedback.score),
          source: 'ai-feedback',
          recommendation: latestFeedback?.summary ?? undefined
        })
      );

    return aiGaps
      .sort((a, b) => b.gapScore - a.gapScore)
      .slice(0, 5);
  }
};
