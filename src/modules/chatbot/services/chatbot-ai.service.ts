import { BaseAiService } from '@ai/services/base.js';
import { AI_SERVICE_UNAVAILABLE_MESSAGE } from '@ai/clients/ai-client.js';
import {
  getConfiguredPrismaAiProvider,
  getDefaultAiModel
} from '@config/ai.js';
import { ApiError } from '@shared/errors/api-error.js';
import { z } from 'zod';
import { logger } from '@/logging/logger.js';
import type {
  ChatbotMessage,
  ChatbotContext,
  ChatbotResponsePayload
} from '../types/chatbot.types.js';

const ChatbotResponseSchema = z.object({
  response: z.string(),
  summary: z.string().optional(),
  nextActions: z.array(z.string()).optional(),
  questions: z.array(z.string()).optional(),
  resources: z.array(z.string()).optional(),
  timeline: z.array(z.string()).optional(),
  reasoning: z.string().optional(),
  confidence: z.number().min(0).max(1).optional()
});

const CHATBOT_RESPONSE_MAX_TOKENS = 700;

const truncateText = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLength
    ? `${trimmed.slice(0, maxLength).trim()}...`
    : trimmed;
};

const stringList = (value: unknown, maxItems = 3) =>
  Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === 'string' && Boolean(item.trim())
        )
        .slice(0, maxItems)
    : [];

const summarizeRecentMessages = (messages: ChatbotContext['recentMessages']) =>
  messages.slice(-3).map((message) => ({
    role: message.role,
    content: truncateText(message.content, 240) ?? ''
  }));

const summarizeCareerContext = (
  careerContext: ChatbotContext['careerContext']
) => {
  const data = (careerContext ?? {}) as Record<string, any>;
  const resume = (data.resume ?? {}) as Record<string, unknown>;
  const roadmap = (data.roadmap ?? {}) as Record<string, unknown>;
  const interview = (data.interview ?? {}) as Record<string, unknown>;
  const nextAction = (data.nextAction ?? {}) as Record<string, unknown>;

  return {
    resume: {
      targetRole: truncateText(resume.inferredTargetRole, 80),
      score: resume.score,
      missingSkills: stringList(resume.missingSkills),
      keywordGaps: stringList(resume.keywordGaps)
    },
    roadmap: {
      targetRole: truncateText(roadmap.targetRole, 80),
      currentLevel: truncateText(roadmap.currentLevel, 50),
      nextMilestone: truncateText(roadmap.nextMilestone, 140),
      activeMilestone: truncateText(roadmap.activeMilestone, 140),
      skillsToBuild: stringList(roadmap.skillsToBuild)
    },
    interview: {
      weakestQuestions: stringList(interview.weakestQuestions, 2),
      practiceAreas: stringList(interview.suggestedPracticeAreas, 2)
    },
    nextAction: truncateText(nextAction.label, 120)
  };
};

const formatStructuredResponse = (
  response: z.infer<typeof ChatbotResponseSchema>
) => {
  const sections = [response.response.trim()];

  if (response.nextActions?.length) {
    sections.push(
      [
        'Next actions:',
        ...response.nextActions.slice(0, 2).map((item) => `- ${item}`)
      ].join('\n')
    );
  }

  if (response.questions?.length) {
    sections.push(
      [
        'Question:',
        ...response.questions.slice(0, 1).map((item) => `- ${item}`)
      ].join('\n')
    );
  }

  return sections.join('\n\n');
};

const getFallbackFocus = (message: string) => {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('resume')) return 'resume';
  if (lowerMessage.includes('interview')) return 'interview';
  if (
    lowerMessage.includes('roadmap') ||
    lowerMessage.includes('career') ||
    lowerMessage.includes('job')
  ) {
    return 'career plan';
  }

  return 'career goal';
};

const getManualSteps = (focus: string) => {
  if (focus === 'resume') {
    return [
      'Match your summary to one target role instead of writing for every job.',
      'Rewrite each bullet with action, scope, and measurable outcome.',
      'Compare one job post against your resume and add only the keywords you can honestly support.'
    ];
  }

  if (focus === 'interview') {
    return [
      'Pick three role requirements and prepare one STAR story for each.',
      'Practice each answer out loud until it fits in 60-90 seconds.',
      'End every answer by connecting the example back to the target role.'
    ];
  }

  if (focus === 'career plan') {
    return [
      'Choose one target role for the next 30 days.',
      'List the top five missing skills from recent job posts.',
      'Turn the highest-priority skill into one portfolio project or weekly practice block.'
    ];
  }

  return [
    'Write the role you want next and why it fits your current experience.',
    'List the strongest three examples you can already prove.',
    'Choose one small action for this week: update a resume section, practice one answer, or apply to two matched roles.'
  ];
};

const getFallbackLead = (focus: string) => {
  if (focus === 'resume') {
    return 'Here is how you can still improve your resume while the AI service recovers:';
  }

  if (focus === 'interview') {
    return 'Here is how you can still prepare for your interview while the AI service recovers:';
  }

  if (focus === 'career plan') {
    return 'Here is how you can still make progress on your career plan while the AI service recovers:';
  }

  return 'Here is how you can still make useful progress while the AI service recovers:';
};

const getRetryAfterMs = (error: unknown) => {
  if (!(error instanceof ApiError)) return undefined;
  const details = error.details;
  if (!details || typeof details !== 'object') return undefined;
  const retryAfterMs = (details as { retryAfterMs?: unknown }).retryAfterMs;
  return typeof retryAfterMs === 'number' ? retryAfterMs : undefined;
};

/**
 * Chatbot AI Service
 * Handles AI-powered responses with context management and streaming support
 */
export class ChatbotAiService extends BaseAiService {
  constructor() {
    super(
      getDefaultAiModel('chatbot', {
        temperature: 0.6,
        maxTokens: CHATBOT_RESPONSE_MAX_TOKENS
      }),
      {
        maxRetries: 2,
        timeoutMs: 20000,
        retryDelayMs: 600,
        unavailableRetryDelayMs: 3000
      }
    );
  }

  /**
   * Generate AI response for chatbot message
   * Maintains conversation context and streaming capability
   */
  async generateResponse(
    userMessage: string,
    sessionId: string,
    context: ChatbotContext
  ): Promise<ChatbotResponsePayload> {
    try {
      const response = await this.executePromptWithSchema(
        'chatbot-response',
        {
          phase: context.conversationPhase,
          userProfile: context.userProfile
            ? `${context.userProfile.name}, ${context.userProfile.role || 'Not specified'}, Level: ${context.userProfile.level || 'General'}`
            : 'Anonymous',
          context: JSON.stringify(
            summarizeRecentMessages(context.recentMessages)
          ),
          careerContext: JSON.stringify(
            summarizeCareerContext(context.careerContext)
          ),
          userMessage
        },
        ChatbotResponseSchema,
        { schemaRetries: 1 }
      );

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        sessionId,
        messageId,
        content: formatStructuredResponse(response),
        role: 'assistant',
        timestamp: new Date().toISOString(),
        context: this.updateContext(
          context,
          userMessage,
          formatStructuredResponse(response)
        ),
        metadata: {
          provider: getConfiguredPrismaAiProvider(this.defaultModel.provider),
          confidence: response.confidence || 0.8,
          structured: {
            summary: response.summary,
            nextActions: response.nextActions ?? [],
            questions: response.questions ?? [],
            resources: response.resources ?? [],
            timeline: response.timeline ?? []
          }
        }
      };
    } catch (error) {
      logger.error({ error, sessionId }, 'Chatbot AI error');
      return this.createFallbackResponse(
        userMessage,
        sessionId,
        context,
        error
      );
    }
  }

  async generatePublicResponse(
    userMessage: string,
    sessionId: string,
    context: ChatbotContext
  ): Promise<ChatbotResponsePayload> {
    try {
      const response = await this.executePromptWithSchema(
        'public-homepage-chatbot-response',
        {
          context: JSON.stringify(summarizeRecentMessages(context.recentMessages)),
          userMessage
        },
        ChatbotResponseSchema,
        { schemaRetries: 1 }
      );

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const content = formatStructuredResponse(response);

      return {
        sessionId,
        messageId,
        content,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        context: this.updateContext(context, userMessage, content),
        metadata: {
          provider: getConfiguredPrismaAiProvider(this.defaultModel.provider),
          confidence: response.confidence || 0.86,
          structured: {
            summary: response.summary,
            nextActions: response.nextActions ?? [],
            questions: response.questions ?? [],
            resources: response.resources ?? [],
            timeline: response.timeline ?? []
          }
        }
      };
    } catch (error) {
      logger.error({ error, sessionId }, 'Public homepage chatbot AI error');
      return this.createFallbackResponse(userMessage, sessionId, context, error);
    }
  }

  private createFallbackResponse(
    userMessage: string,
    sessionId: string,
    context: ChatbotContext,
    error?: unknown
  ): ChatbotResponsePayload {
    const focus = getFallbackFocus(userMessage);
    const steps = getManualSteps(focus);
    const reason = error instanceof ApiError ? error.code : 'AI_UNAVAILABLE';
    const retryAfterMs = getRetryAfterMs(error);
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const response = [
      AI_SERVICE_UNAVAILABLE_MESSAGE,
      '',
      getFallbackLead(focus),
      ...steps.map((step, index) => `${index + 1}. ${step}`),
      '',
      'When the retry timer is ready, ask again and CareerAI will personalize this guidance with your latest context.'
    ].join('\n');

    return {
      sessionId,
      messageId,
      content: response,
      role: 'assistant',
      timestamp: new Date().toISOString(),
      context: this.updateContext(context, userMessage, response),
      metadata: {
        provider: getConfiguredPrismaAiProvider(this.defaultModel.provider),
        confidence: 0.35,
        fallback: true,
        reason,
        retryAfterMs
      }
    };
  }

  /**
   * Build system prompt with context awareness
   */
  private buildSystemPrompt(context: ChatbotContext): string {
    const userProfile = context.userProfile
      ? `\nUser: ${context.userProfile.name || 'Guest'}, Role: ${context.userProfile.role || 'Not specified'}, Level: ${context.userProfile.level || 'Not specified'}`
      : '\nUser: Anonymous';

    const phase = `\nConversation Phase: ${context.conversationPhase}`;

    return `You are a professional AI career mentor and advisor. You provide thoughtful, actionable advice on career development, skill building, and professional growth.${userProfile}${phase}

Guidelines:
- Provide clear, concise, and actionable advice
- Ask clarifying questions when needed
- Maintain context from previous messages
- Be encouraging and supportive
- Focus on practical strategies and resources
- Remember user's goals and preferences`;
  }

  /**
   * Build message history for LLM
   */
  private buildMessageHistory(
    context: ChatbotContext,
    currentMessage: string
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    // Build from recent messages in context (last 10 messages for context window)
    const history = context.recentMessages.slice(-10).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    // Add current user message
    history.push({
      role: 'user',
      content: currentMessage
    });

    return history;
  }

  /**
   * Update conversation context after AI response
   */
  private updateContext(
    context: ChatbotContext,
    userMessage: string,
    assistantResponse: string
  ): ChatbotContext {
    const updatedRecentMessages = [
      ...context.recentMessages.slice(-9), // Keep last 9 messages (rolling window)
      { role: 'user' as const, content: userMessage },
      { role: 'assistant' as const, content: assistantResponse }
    ];

    // Advanced phase transitions
    let nextPhase = context.conversationPhase;
    const lowerMessage = userMessage.toLowerCase();

    if (context.conversationPhase === 'greeting') {
      if (
        lowerMessage.length > 30 ||
        ['help', 'how', 'goal', 'want', 'need'].some((k) =>
          lowerMessage.includes(k)
        )
      ) {
        nextPhase = 'exploration';
      }
    } else if (context.conversationPhase === 'exploration') {
      if (
        ['suggest', 'advice', 'recommend', 'tell me', 'how to'].some((k) =>
          lowerMessage.includes(k)
        )
      ) {
        nextPhase = 'advice';
      }
    } else if (context.conversationPhase === 'advice') {
      if (
        ['plan', 'next steps', 'action', 'todo', 'start'].some((k) =>
          lowerMessage.includes(k)
        )
      ) {
        nextPhase = 'action_planning';
      }
    }

    return {
      ...context,
      recentMessages: updatedRecentMessages,
      conversationPhase: nextPhase,
      sessionMetadata: {
        ...context.sessionMetadata,
        lastInteractionAt: new Date().toISOString(),
        messageCount: (context.sessionMetadata?.messageCount || 0) + 2
      }
    };
  }

  /**
   * Generate a summary of the conversation
   */
  async generateSummary(
    messages: ChatbotMessage[],
    userProfile?: any
  ): Promise<string> {
    const conversation = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const response = await this.executePromptWithSchema(
      'chatbot-summary',
      {
        conversation,
        userProfile: userProfile ? JSON.stringify(userProfile) : 'Anonymous'
      },
      z.object({
        summary: z.string(),
        themes: z.array(z.string()),
        actionItems: z.array(z.string())
      })
    );

    return response.summary;
  }

  /**
   * Extract deeper context from conversation history
   */
  async extractContext(messages: ChatbotMessage[]): Promise<any> {
    const messagesText = messages
      .slice(-10)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    return this.executePromptWithSchema(
      'chatbot-context',
      { messages: messagesText },
      z.object({
        goals: z.array(z.string()),
        challenges: z.array(z.string()),
        interests: z.array(z.string()),
        stage: z.string()
      })
    );
  }

  /**
   * Generate a concise 2-4 word title for the session based on the first message
   */
  async generateTitle(userMessage: string): Promise<string> {
    try {
      const response = await this.executePromptWithSchema(
        'chatbot-title',
        { userMessage },
        z.object({
          title: z.string()
        }),
        { schemaRetries: 1 }
      );

      let cleanTitle = (response.title || '').trim().replace(/['"“”]/g, '');
      if (cleanTitle.length > 20) {
        cleanTitle = cleanTitle.slice(0, 20).trim();
      }
      return cleanTitle || 'Career Guidance';
    } catch (error) {
      logger.error({ error }, 'Failed to generate conversation title');
      return 'Career Consultation';
    }
  }

  /**
   * Initialize new conversation context
   */
  static createInitialContext(userProfile?: any): ChatbotContext {
    return {
      recentMessages: [],
      userProfile: userProfile && {
        name: userProfile.name,
        role: userProfile.role,
        level: userProfile.level
      },
      conversationPhase: 'greeting',
      sessionMetadata: {
        startedAt: new Date().toISOString()
      }
    };
  }
}
