import { describe, expect, it } from 'vitest';
import {
  buildLinkedInJobsSearchUrl,
  buildLinkedInSearchAssistantUrl
} from '@modules/jobs/services/job-search-url.js';
import { analyzeJobFitSignals } from '@modules/jobs/services/job-fit-calculations.js';

describe('buildLinkedInJobsSearchUrl', () => {
  it('builds a LinkedIn Jobs search URL from a simple role', () => {
    expect(
      buildLinkedInJobsSearchUrl({ recommendationTitle: 'AI Engineer' })
    ).toBe('https://www.linkedin.com/jobs/search/?keywords=AI%20Engineer');
  });

  it('combines career level, role, and skill context with proper encoding', () => {
    expect(
      buildLinkedInJobsSearchUrl({
        recommendationTitle: 'Full Stack Developer',
        careerLevel: 'Junior',
        matchedSkills: ['Docker'],
        missingSkills: ['Kubernetes']
      })
    ).toBe(
      'https://www.linkedin.com/jobs/search/?keywords=Junior%20Full%20Stack%20Developer%20Docker%20Kubernetes'
    );
  });

  it('deduplicates roles and encodes special characters safely', () => {
    expect(
      buildLinkedInJobsSearchUrl({
        recommendationTitle: 'Backend Engineer',
        targetRole: 'Backend Engineer',
        roadmapRole: 'Backend Engineer',
        careerLevel: 'General',
        matchedSkills: ['Node.js', 'C++']
      })
    ).toBe(
      'https://www.linkedin.com/jobs/search/?keywords=Backend%20Engineer%20Node.js%20C%2B%2B'
    );
  });

  it('keeps the search assistant URL API available under the honest helper name', () => {
    expect(
      buildLinkedInSearchAssistantUrl({
        recommendationTitle: 'AI Engineer',
        matchedSkills: ['LLM']
      })
    ).toBe('https://www.linkedin.com/jobs/search/?keywords=AI%20Engineer%20LLM');
  });
});

describe('analyzeJobFitSignals', () => {
  it('scores a job description from resume, roadmap, and missing skill signals', () => {
    const analysis = analyzeJobFitSignals({
      description:
        'We need a React TypeScript engineer with API, Docker, and PostgreSQL experience.',
      userSkills: ['React', 'TypeScript', 'API'],
      resumeGaps: ['Docker', 'Kubernetes'],
      resumeScore: 78,
      targetRole: 'React Engineer',
      roadmapRole: 'Frontend Developer',
      experienceLevel: 'Junior'
    });

    expect(analysis.atsMatchPercent).toBeGreaterThan(50);
    expect(analysis.matchingStrengths).toEqual(['React', 'TypeScript', 'API']);
    expect(analysis.missingSkills).toContain('Docker');
    expect(analysis.recommendedImprovements[0]).toContain('Docker');
    expect(analysis.sourceSignals).toMatchObject({
      resumeScore: 78,
      experienceLevel: 'Junior',
      matchedSkillCount: 3
    });
  });
});
