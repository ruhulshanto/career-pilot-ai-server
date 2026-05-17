import { promptManager } from './manager.js';
import { getDefaultAiModel } from '@config/ai.js';

const defaultChatbotModel = getDefaultAiModel('chatbot', {
  temperature: 0.6,
  maxTokens: 700
});

/**
 * Register Chatbot AI Prompts
 * Registers all chatbot-related prompt templates for AI responses and context management
 */
promptManager.register({
  id: 'chatbot-response',
  name: 'Chatbot Response',
  description: 'Generate career mentoring responses with context awareness',
  template:
    `Act as a concise career mentor.\n` +
    `Phase: ${'${phase}'}\nUser: ${'${userProfile}'}\nCareer context: ${'${careerContext}'}\nRecent chat: ${'${context}'}\nMessage: ${'${userMessage}'}\n\n` +
    `Answer fast. Use the context only when relevant. Keep the reply to 4-8 short sentences. Use bullets only for concrete steps. Ask at most one follow-up question.\n` +
    `Return valid JSON only: {"response":"...","summary":"...","nextActions":["max 2 short actions"],"questions":["max 1 question"],"confidence":0.8}`,
  variables: [
    'phase',
    'userProfile',
    'careerContext',
    'context',
    'userMessage'
  ],
  model: defaultChatbotModel,
  systemMessage: 'You are a concise career mentor. Return valid JSON only.'
});

promptManager.register({
  id: 'public-homepage-chatbot-response',
  name: 'Public Homepage Chatbot Response',
  description:
    'Generate polished, stateless homepage assistant responses for public visitors',
  template:
    `You are Career Pilot AI, a premium AI career copilot on a SaaS landing page.\n` +
    `Visitor context: unauthenticated public preview, no saved profile, no stored history.\n` +
    `Recent public chat: ${'${context}'}\n` +
    `Visitor message: ${'${userMessage}'}\n\n` +
    `Your role combines AI career strategist, resume advisor, interview coach, and job-search copilot.\n` +
    `Response rules:\n` +
    `- Start with one specific insight or diagnosis tied to the visitor's question.\n` +
    `- Give 2-4 practical next moves, not generic motivation.\n` +
    `- If the question is broad, choose a smart default path and ask one precise follow-up.\n` +
    `- For resume questions, focus on target role, proof, keywords, measurable outcomes, and ATS clarity.\n` +
    `- For career path questions, focus on role target, skill stack, portfolio signals, and a short timeline.\n` +
    `- For interview questions, focus on practice structure, answer quality, and feedback loops.\n` +
    `- For job-search questions, focus on positioning, tracking, application quality, and realistic sources.\n` +
    `- Keep it modern, confident, concise, and useful in 90-160 words.\n` +
    `- Avoid filler phrases like "I'm here to help", "great question", or vague encouragement.\n` +
    `- Mention creating a workspace only when it naturally helps save progress, and keep it to one sentence.\n\n` +
    `Return valid JSON only: {"response":"...","summary":"...","nextActions":["2-3 premium short actions"],"questions":["max 1 sharp question"],"confidence":0.86}`,
  variables: ['context', 'userMessage'],
  model: defaultChatbotModel,
  systemMessage:
    'You are Career Pilot AI, a premium stateless career copilot for public visitors. Return valid JSON only.'
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

promptManager.register({
  id: 'chatbot-title',
  name: 'Chatbot Session Title Generator',
  description: 'Semantically summarize the user message into a 2-4 word professional conversation title under 20 characters.',
  template:
    `Your job is to generate a short, professional conversation title based on the user's message.\n\n` +
    `RULES:\n` +
    `- Title must be 2 to 4 words ONLY\n` +
    `- Title must be UNDER 20 characters INCLUDING spaces\n` +
    `- Capture the TOPIC/INTENT, do NOT copy raw words from the message\n` +
    `- Title must be human-readable and meaningful\n` +
    `- NEVER cut words in half\n` +
    `- NEVER use quotes, punctuation, or these words: Chat, Consultation, Session, My, First, Help, New\n\n` +
    `EXAMPLES:\n` +
    `Message: "how can i build a resume?" -> Title: "Resume Building"\n` +
    `Message: "help me prepare for frontend interview" -> Title: "Frontend Interview"\n` +
    `Message: "how to switch career into ui ux design" -> Title: "UX Career Shift"\n` +
    `Message: "write react developer portfolio" -> Title: "React Portfolio"\n` +
    `Message: "what skills do i need for data science" -> Title: "Data Science Skills"\n` +
    `Message: "how do i negotiate salary offer" -> Title: "Salary Negotiation"\n\n` +
    `User message: ${'${userMessage}'}\n\n` +
    `Return ONLY valid JSON: {"title": "..."}`,
  variables: ['userMessage'],
  model: defaultChatbotModel,
  systemMessage: 'You generate extremely concise 2-4 word career conversation titles under 20 characters. Return valid JSON only.'
});
