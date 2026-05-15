import { promptManager } from './manager.js';
import { getRoadmapAiModel } from '@config/ai.js';

const defaultRoadmapModel = {
  ...getRoadmapAiModel(),
  maxTokens: 4096
};

promptManager.register({
  id: 'career-roadmap-generation',
  name: 'Career Roadmap Generation',
  description:
    'Generate a structured, personalized AI career roadmap from resume analysis and user goals.',
  template: `Create a concise, personalized career roadmap as strict JSON.

Profile:
- Target role: ${'${targetRole}'}
- Current level: ${'${currentLevel}'}
- Preferred path: ${'${preferredPath}'}
- Industry: ${'${industry}'}
- Goals: ${'${careerGoals}'}
- Resume summary: ${'${resumeSummary}'}
- Resume excerpt: ${'${resumeText}'}

Signals:
- Strengths: ${'${strengths}'}
- Weaknesses: ${'${weaknesses}'}
- Missing skills: ${'${missingSkills}'}
- Improvements: ${'${improvementSuggestions}'}
- Keyword gaps: ${'${keywordGaps}'}
- Next actions: ${'${recommendedNextActions}'}

Rules: JSON only. No markdown or code fences. No newline characters inside string values. Keep strings under 160 chars. Ground every recommendation in the profile/signals. Use progress 0. Use milestone IDs "m1", "m2", etc.

Return exactly:
{
  "title": "string",
  "targetRole": "string",
  "currentLevel": "string",
  "estimatedDurationMonths": 6,
  "summary": "string",
  "milestones": [{"id":"m1","title":"string","description":"string","durationWeeks":4,"requiredSkills":["string"],"recommendedResources":["string"],"projectSuggestions":["string"],"successCriteria":["string"],"progress":0,"status":"pending"}],
  "projects": [{"title":"string","description":"string","difficulty":"beginner|intermediate|advanced","estimatedWeeks":4,"technologies":["string"],"skillsDemonstrated":["string"],"portfolioValue":"string"}],
  "skills": [{"name":"string","category":"string","currentLevel":"string","targetLevel":"string","priority":"low|medium|high|critical","progress":0,"status":"not-started"}],
  "certifications": ["string"],
  "learningRecommendations": ["string"],
  "learningGoals": [{"title":"string","description":"string","resources":["string"],"progress":0,"status":"pending"}],
  "timeline": {"phases":[{"title":"string","durationMonths":1,"milestones":["m1"]}],"recommendations":["string"]}
}`,
  variables: [
    'targetRole',
    'currentLevel',
    'preferredPath',
    'industry',
    'careerGoals',
    'resumeSummary',
    'resumeText',
    'strengths',
    'weaknesses',
    'missingSkills',
    'improvementSuggestions',
    'keywordGaps',
    'recommendedNextActions'
  ],
  model: defaultRoadmapModel,
  systemMessage:
    'You are an AI career mentor. Return strict JSON only, grounded in the provided user data.'
});
