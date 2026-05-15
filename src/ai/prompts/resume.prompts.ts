import { promptManager } from './manager.js';
import { getDefaultAiModel } from '@config/ai.js';

const defaultResumeModel = getDefaultAiModel('resume', {
  temperature: 0.25,
  maxTokens: 4096
});

promptManager.register({
  id: 'resume-analysis',
  name: 'Resume Analysis',
  description:
    'Analyze a resume and return structured ATS, role-fit, keyword, and improvement feedback.',
  template: `Analyze this resume for an AI-powered career platform.

Resume title: ${'${title}'}
File type: ${'${fileType}'}

Resume text:
${'${resumeText}'}

Return only valid JSON with this exact shape:
{
  "atsScore": 0,
  "roleFitScore": 0,
  "inferredTargetRole": "string",
  "experienceLevel": "string",
  "summary": "...",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "missingSkills": ["..."],
  "improvementSuggestions": ["..."],
  "keywordGaps": ["..."],
  "recommendedNextActions": ["..."]
}

Scoring rules:
- atsScore and roleFitScore must be numbers from 0 to 100.
- inferredTargetRole must be the most likely next or target role supported by the resume, such as "Frontend Engineer" or "Data Analyst".
- experienceLevel must be one of Entry Level, Junior, Mid-Level, Senior, Lead, Principal, or Executive based only on the resume evidence.
- Do not invent job history, employers, education, certifications, or technologies not present in the resume.
- If information is missing, list it as a weakness or keyword gap.
- Keep each string under 180 characters.
- Do not include markdown, comments, trailing commas, code fences, or unescaped line breaks inside string values.`,
  variables: ['title', 'fileType', 'resumeText'],
  model: defaultResumeModel,
  systemMessage:
    'You are a senior technical recruiter and ATS optimization expert. Return structured JSON only.'
});
