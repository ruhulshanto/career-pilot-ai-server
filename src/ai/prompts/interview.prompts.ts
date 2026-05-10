import { promptManager } from './manager.js';
import type { AiModel } from '../types.js';

const defaultInterviewModel: AiModel = {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7
};

promptManager.register({
  id: 'interview-question-generation',
  name: 'Interview Question Generation',
  description:
    'Generate mock interview questions for a candidate preparing for a role.',
  template:
    `You are an AI interview coach. Generate ${'${questionCount}'} interview questions for a candidate preparing for the role of ${'${title}'} with a focus on ${'${roleTarget}'}.` +
    ` Use the candidate level ${'${level}'}. Return only valid JSON in this format:\n{\n  "questions": [\n    {"questionId": "q1", "prompt": "..."},\n    ...\n  ]\n}`,
  variables: ['title', 'roleTarget', 'level', 'questionCount'],
  model: defaultInterviewModel,
  systemMessage:
    'You are an expert technical interviewer who returns structured JSON output.'
});

promptManager.register({
  id: 'interview-feedback-summary',
  name: 'Interview Feedback Summary',
  description:
    'Generate interview feedback, strengths, weaknesses, and score based on candidate answers.',
  template:
    `You are an AI interview evaluator. Given the interview details and candidate answers, provide a JSON summary with the following fields:\n` +
    `- summary: short assessment\n` +
    `- strengths: array of strengths\n` +
    `- weaknesses: array of weaknesses\n` +
    `- suggestions: array of improvement recommendations\n` +
    `- score: numeric score from 0 to 100\n\n` +
    `Interview details:\nTitle: ${'${title}'}\nRole Target: ${'${roleTarget}'}\nLevel: ${'${level}'}\nQuestions and Answers: ${'${questionAnswerPairs}'}\n` +
    `Return only valid JSON with no additional text.`,
  variables: ['title', 'roleTarget', 'level', 'questionAnswerPairs'],
  model: defaultInterviewModel,
  systemMessage:
    'You are an expert interview coach providing objective performance feedback.'
});
