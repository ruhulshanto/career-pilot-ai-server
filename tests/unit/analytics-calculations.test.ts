import { describe, expect, it } from 'vitest';
import {
  averageDurationMs,
  buildAverageScoreTrend,
  buildDailyCountTrend,
  percentChange,
  scoreDistribution,
  topSkillSignals
} from '@modules/analytics/services/analytics-calculations.js';

describe('analytics calculation helpers', () => {
  it('builds daily count trends from real rows and fills empty days with zero', () => {
    const now = new Date('2026-05-15T12:00:00.000Z');

    expect(
      buildDailyCountTrend(
        [
          { createdAt: new Date('2026-05-14T08:00:00.000Z') },
          { createdAt: new Date('2026-05-14T20:00:00.000Z') },
          { createdAt: new Date('2026-05-15T09:00:00.000Z') },
          { createdAt: new Date('2026-05-01T09:00:00.000Z') }
        ],
        3,
        now
      )
    ).toEqual([
      { date: '2026-05-13', count: 0 },
      { date: '2026-05-14', count: 2 },
      { date: '2026-05-15', count: 1 }
    ]);
  });

  it('averages score history by day without inventing scores for empty days', () => {
    const now = new Date('2026-05-15T12:00:00.000Z');

    expect(
      buildAverageScoreTrend(
        [
          { createdAt: new Date('2026-05-14T08:00:00.000Z'), score: 70 },
          { createdAt: new Date('2026-05-14T20:00:00.000Z'), score: 90 },
          { createdAt: new Date('2026-05-15T09:00:00.000Z'), score: null }
        ],
        3,
        now
      )
    ).toEqual([
      { date: '2026-05-13', score: null },
      { date: '2026-05-14', score: 80 },
      { date: '2026-05-15', score: null }
    ]);
  });

  it('places scores into production dashboard buckets', () => {
    expect(scoreDistribution([40, 50, 69, 70, 84, 85, 100, null])).toEqual({
      '0-49': 1,
      '50-69': 2,
      '70-84': 2,
      '85-100': 2
    });
  });

  it('calculates response durations and percentage changes safely', () => {
    expect(
      averageDurationMs([
        {
          createdAt: new Date('2026-05-15T10:00:00.000Z'),
          updatedAt: new Date('2026-05-15T10:00:01.000Z')
        },
        {
          createdAt: new Date('2026-05-15T10:00:00.000Z'),
          updatedAt: new Date('2026-05-15T10:00:03.000Z')
        }
      ])
    ).toBe(2000);
    expect(percentChange(12, 8)).toBe(50);
    expect(percentChange(3, 0)).toBe(100);
    expect(percentChange(0, 0)).toBe(0);
  });

  it('extracts repeated skill signals from AI feedback payloads', () => {
    expect(
      topSkillSignals([
        ['React', 'System design', 'React'],
        { missing: ['SQL', 'System design'] },
        'Communication'
      ])
    ).toEqual(['React', 'System design', 'Communication', 'SQL']);
  });
});
