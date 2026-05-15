type JobSearchAssistantContext = {
  recommendationTitle?: string;
  targetRole?: string;
  roadmapRole?: string;
  careerLevel?: string;
  matchedSkills?: string[];
  missingSkills?: string[];
};

const normalizeSearchToken = (value: string) =>
  value.replace(/\s+/g, ' ').trim();

const isSpecificCareerLevel = (value: string) => {
  const normalized = value.toLowerCase();
  return !['general', 'unknown', 'not available', 'n/a'].includes(normalized);
};

const uniqueSearchTokens = (items: Array<string | undefined>) => {
  const seen = new Set<string>();

  return items.reduce<string[]>((tokens, item) => {
    if (!item) return tokens;

    const token = normalizeSearchToken(item);
    const key = token.toLowerCase();
    if (!token || seen.has(key)) return tokens;

    seen.add(key);
    tokens.push(token);
    return tokens;
  }, []);
};

export const buildLinkedInSearchAssistantUrl = ({
  recommendationTitle,
  targetRole,
  roadmapRole,
  careerLevel,
  matchedSkills = [],
  missingSkills = []
}: JobSearchAssistantContext) => {
  const level =
    careerLevel && isSpecificCareerLevel(careerLevel) ? careerLevel : undefined;
  const keywords = uniqueSearchTokens([
    level,
    recommendationTitle,
    targetRole,
    roadmapRole,
    ...matchedSkills,
    ...missingSkills
  ]).join(' ');

  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}`;
};

export const buildLinkedInJobsSearchUrl = buildLinkedInSearchAssistantUrl;
