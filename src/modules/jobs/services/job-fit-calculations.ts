const KEY_SKILL_TERMS = [
  'react',
  'next.js',
  'typescript',
  'javascript',
  'node.js',
  'express',
  'postgresql',
  'sql',
  'mongodb',
  'prisma',
  'redis',
  'docker',
  'kubernetes',
  'aws',
  'azure',
  'gcp',
  'ci/cd',
  'testing',
  'jest',
  'vitest',
  'playwright',
  'api',
  'rest',
  'graphql',
  'system design',
  'security',
  'analytics',
  'machine learning',
  'ai',
  'llm',
  'python',
  'java',
  'c++',
  'communication',
  'leadership'
];

export const clampJobScore = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)));

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const unique = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const label = item.trim();
    const key = normalize(label);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const extractJobSkillTerms = (description: string) => {
  const normalized = normalize(description);
  return KEY_SKILL_TERMS.filter((term) => normalized.includes(term));
};

export const analyzeJobFitSignals = ({
  description,
  userSkills,
  resumeGaps,
  resumeScore = 0,
  targetRole,
  roadmapRole,
  experienceLevel
}: {
  description: string;
  userSkills: string[];
  resumeGaps: string[];
  resumeScore?: number;
  targetRole?: string;
  roadmapRole?: string;
  experienceLevel?: string;
}) => {
  const descriptionSkills = extractJobSkillTerms(description);
  const normalizedDescription = normalize(description);
  const matchingStrengths = unique(
    userSkills.filter((skill) => normalizedDescription.includes(normalize(skill)))
  ).slice(0, 8);
  const missingFromDescription = descriptionSkills.filter(
    (skill) =>
      !userSkills.some((userSkill) => normalize(userSkill).includes(skill))
  );
  const missingSkills = unique([
    ...resumeGaps.filter((gap) => normalizedDescription.includes(normalize(gap))),
    ...missingFromDescription
  ]).slice(0, 8);
  const targetRoleMatch =
    targetRole && normalizedDescription.includes(normalize(targetRole)) ? 8 : 0;
  const roadmapRoleMatch =
    roadmapRole && normalizedDescription.includes(normalize(roadmapRole)) ? 6 : 0;
  const atsMatchPercent = clampJobScore(
    44 +
      Math.min(28, matchingStrengths.length * 7) -
      Math.min(24, missingSkills.length * 4) +
      Math.min(12, resumeScore / 10) +
      targetRoleMatch +
      roadmapRoleMatch
  );
  const recommendedImprovements = missingSkills.length
    ? missingSkills.slice(0, 5).map((skill) =>
        `Add quantified resume evidence or project experience for ${skill}.`
      )
    : [
        'Mirror the job description language in your resume summary and strongest project bullets.',
        'Add measurable outcomes to the top three bullets most relevant to this role.'
      ];
  const insights = [
    matchingStrengths.length
      ? `${matchingStrengths.length} resume or roadmap skill signal${
          matchingStrengths.length === 1 ? '' : 's'
        } match this description.`
      : 'No strong skill overlap was found yet; use this as a gap-discovery lead.',
    missingSkills.length
      ? `${missingSkills.length} missing or underrepresented skill signal${
          missingSkills.length === 1 ? '' : 's'
        } should be addressed before applying.`
      : 'No major missing skill signals were detected from the current resume context.'
  ];

  if (experienceLevel) {
    insights.push(`Fit was calibrated against your current ${experienceLevel} profile.`);
  }

  return {
    atsMatchPercent,
    matchingStrengths,
    missingSkills,
    recommendedImprovements,
    insights,
    sourceSignals: {
      resumeScore: resumeScore || undefined,
      targetRole,
      roadmapRole,
      experienceLevel,
      matchedSkillCount: matchingStrengths.length,
      missingSkillCount: missingSkills.length
    }
  };
};
