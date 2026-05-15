type DateInput = Date | string;

type ScorePoint = {
  createdAt: DateInput;
  score: number | null;
};

type DurationPoint = {
  createdAt: DateInput;
  updatedAt: DateInput;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const dateKey = (date: DateInput) => toDate(date).toISOString().slice(0, 10);

export const clampMetric = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)));

export const percentChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

export const buildDailyCountTrend = <T extends { createdAt: DateInput }>(
  rows: T[],
  days = 30,
  now = new Date()
) => {
  const rangeStart = startOfDay(new Date(now.getTime() - (days - 1) * DAY_MS));
  const counts = new Map<string, number>();

  for (const row of rows) {
    const createdAt = toDate(row.createdAt);
    if (createdAt < rangeStart || createdAt > now) continue;
    const key = dateKey(createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(rangeStart.getTime() + index * DAY_MS);
    const key = dateKey(date);
    return {
      date: key,
      count: counts.get(key) ?? 0
    };
  });
};

export const buildAverageScoreTrend = (
  rows: ScorePoint[],
  days = 30,
  now = new Date()
) => {
  const rangeStart = startOfDay(new Date(now.getTime() - (days - 1) * DAY_MS));
  const buckets = new Map<string, number[]>();

  for (const row of rows) {
    if (typeof row.score !== 'number') continue;
    const createdAt = toDate(row.createdAt);
    if (createdAt < rangeStart || createdAt > now) continue;
    const key = dateKey(createdAt);
    buckets.set(key, [...(buckets.get(key) ?? []), row.score]);
  }

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(rangeStart.getTime() + index * DAY_MS);
    const key = dateKey(date);
    const scores = buckets.get(key) ?? [];
    return {
      date: key,
      score: scores.length
        ? clampMetric(scores.reduce((sum, score) => sum + score, 0) / scores.length)
        : null
    };
  });
};

export const scoreDistribution = (scores: Array<number | null>) => {
  const distribution = {
    '0-49': 0,
    '50-69': 0,
    '70-84': 0,
    '85-100': 0
  };

  for (const score of scores) {
    if (typeof score !== 'number') continue;
    const rounded = clampMetric(score);
    if (rounded < 50) distribution['0-49'] += 1;
    else if (rounded < 70) distribution['50-69'] += 1;
    else if (rounded < 85) distribution['70-84'] += 1;
    else distribution['85-100'] += 1;
  }

  return distribution;
};

export const averageDurationMs = (rows: DurationPoint[]) => {
  const durations = rows
    .map((row) => toDate(row.updatedAt).getTime() - toDate(row.createdAt).getTime())
    .filter((duration) => Number.isFinite(duration) && duration >= 0);

  if (!durations.length) return 0;
  return Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const textItems = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textItems);
  if (isRecord(value)) return Object.values(value).flatMap(textItems);
  return [];
};

const normalizeSkill = (value: string) =>
  value
    .replace(/^[\s\-*\u2022]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

export const topSkillSignals = (values: unknown[], limit = 5) => {
  const counts = new Map<string, { label: string; count: number }>();

  for (const value of values) {
    for (const item of textItems(value)) {
      const label = normalizeSkill(item);
      if (label.length < 2 || label.length > 80) continue;
      const key = label.toLowerCase();
      const current = counts.get(key);
      counts.set(key, {
        label: current?.label ?? label,
        count: (current?.count ?? 0) + 1
      });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((item) => item.label);
};
