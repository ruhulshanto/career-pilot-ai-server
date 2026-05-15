import { promptManager } from './manager.js';
import { getDefaultAiModel } from '@config/ai.js';

const defaultInterviewModel = getDefaultAiModel('interview', {
  temperature: 0.7
});

promptManager.register({
  id: 'interview-question-generation',
  name: 'Interview Question Generation',
  description:
    'Generate mock interview questions for a candidate preparing for a role.',
  template:
    `Generate ${'${questionCount}'} mock interview questions for this candidate.\n` +
    `Interview title: ${'${title}'}\nTarget role: ${'${roleTarget}'}\nExperience level: ${'${level}'}\n\n` +
    `Requirements:\n` +
    `- Mix behavioral, role-specific, and practical scenario questions.\n` +
    `- Match the difficulty to the experience level.\n` +
    `- Make every question specific to the target role.\n` +
    `- Avoid duplicate questions.\n\n` +
    `Return only valid JSON in this format:\n{\n  "questions": [\n    {"questionId": "q1", "prompt": "..."},\n    {"questionId": "q2", "prompt": "..."}\n  ]\n}`,
  variables: ['title', 'roleTarget', 'level', 'questionCount'],
  model: defaultInterviewModel,
  systemMessage:
    'You are an expert technical and behavioral interviewer. Return structured JSON only.'
});

promptManager.register({
  id: 'interview-feedback-summary',
  name: 'Interview Feedback Summary',
  description:
    'Generate interview feedback, strengths, weaknesses, and score based on candidate answers.',
  template:
    `Evaluate this mock interview. Be specific, fair, and actionable.\n\n` +
    `Return JSON with these exact fields:\n` +
    `- summary: 2-3 sentence assessment of readiness for the role\n` +
    `- strengths: array of specific strengths shown in the answers\n` +
    `- weaknesses: array of concrete gaps or unclear areas\n` +
    `- suggestions: array of next practice actions the candidate can take\n` +
    `- questionFeedback: array with one item per question using {questionId, score, whatWorked, improve, strongerAnswer}\n` +
    `- score: numeric score from 0 to 100\n\n` +
    `For each questionFeedback item, use the original questionId, score the answer from 0 to 100, list 1-3 things that worked, list 2-4 targeted improvements, and write a short strongerAnswer mentoring note.\n\n` +
    `Interview details:\nTitle: ${'${title}'}\nRole Target: ${'${roleTarget}'}\nLevel: ${'${level}'}\nQuestions and Answers: ${'${questionAnswerPairs}'}\n` +
    `Return only valid JSON with no additional text.`,
  variables: ['title', 'roleTarget', 'level', 'questionAnswerPairs'],
  model: defaultInterviewModel,
  systemMessage:
    'You are an expert interview mentor providing objective performance feedback.'
});
