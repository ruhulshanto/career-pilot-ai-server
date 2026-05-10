import { promptManager } from './manager.js';
import type { AiModel } from '../types.js';

const defaultChatbotModel: AiModel = {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7
};

/**
 * Register Chatbot AI Prompts
 * Registers all chatbot-related prompt templates for AI responses and context management
 */
promptManager.register({
  id: 'chatbot-response',
  name: 'Chatbot Response',
  description: 'Generate career coaching responses with context awareness',
  template:
    `You are an expert career coach and advisor. The user is at the ${'${phase}'} phase of conversation.\n\nUser Profile: ${'${userProfile}'}\n\nRecent context: ${'${context}'}\n\nUser message: ${'${userMessage}'}\n\n` +
    `Provide a thoughtful response that addresses their concern and builds on the conversation context.\n` +
    `Return JSON with: {"response": "...", "reasoning": "...", "confidence": 0.95}`,
  variables: ['phase', 'userProfile', 'context', 'userMessage'],
  model: defaultChatbotModel,
  systemMessage:
    'You are a professional career coach providing personalized guidance. Always respond with valid JSON.'
});

promptManager.register({
  id: 'chatbot-summary',
  name: 'Chatbot Session Summary',
  description: 'Generate concise summaries of chatbot conversations',
  template:
    `Analyze this conversation and provide a professional summary.\n\nConversation: ${'${conversation}'}\n\nUser Profile: ${'${userProfile}'}\n\n` +
    `Return JSON with: {"summary": "...", "themes": [...], "actionItems": [...], "sentiment": "positive|neutral|negative"}`,
  variables: ['conversation', 'userProfile'],
  model: defaultChatbotModel,
  systemMessage: 'Provide concise, actionable summaries in valid JSON format.'
});

promptManager.register({
  id: 'chatbot-context',
  name: 'Chatbot Context Manager',
  description: 'Extract and update conversation context',
  template:
    `Extract key context information from this conversation.\n\nMessages: ${'${messages}'}\n\n` +
    `Return JSON with: {"goals": [...], "challenges": [...], "interests": [...], "stage": "..."}`,
  variables: ['messages'],
  model: defaultChatbotModel,
  systemMessage: 'Extract context in valid JSON format.'
});
