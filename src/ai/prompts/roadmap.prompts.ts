import { promptManager } from './manager.js';
import type { AiModel } from '../types.js';

const defaultRoadmapModel: AiModel = {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7
};

promptManager.register({
  id: 'career-roadmap-generation',
  name: 'Career Roadmap Generation',
  description:
    'Generate a structured career roadmap with milestones, skills, and personalized recommendations.',
  template: `You are an expert career coach. Generate a structured career roadmap for a candidate targeting the role of ${'${targetRole}'} at the current level ${'${currentLevel}'}. Use the candidate background: ${'${experienceSummary}'}. Target industry: ${'${industry}'}. The candidate wants to achieve these goals: ${'${careerGoals}'}. Return only valid JSON with the following structure:\n{\n  "milestones": [\n    {"id": "m1", "title": "...", "description": "...", "progress": 0, "status": "pending", "recommendation": "..."}\n  ],\n  "skills": [\n    {"name": "...", "currentLevel": "...", "targetLevel": "...", "progress": 0, "importance": "..."}\n  ],\n  "timeline": {\n    "phases": [\n      {"title": "...", "durationMonths": 0, "milestones": ["m1"]}\n    ],\n    "recommendations": ["..."]\n  }\n}`,
  variables: [
    'targetRole',
    'currentLevel',
    'experienceSummary',
    'industry',
    'careerGoals'
  ],
  model: defaultRoadmapModel,
  systemMessage: 'You are an AI career coach that returns structured JSON only.'
});
