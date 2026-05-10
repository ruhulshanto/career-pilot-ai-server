import { BaseAiService } from '@ai/services/base.js';
import { AiModel, AiResponseParser } from '@ai/index.js';
import { env } from '@config/env.js';
import { z } from 'zod';
import { logger } from '@/logging/logger.js';
import type {
  ChatbotMessage,
  ChatbotContext,
  ChatbotResponsePayload
} from '../types/chatbot.types.js';

const ChatbotResponseSchema = z.object({
  response: z.string(),
  reasoning: z.string().optional(),
  confidence: z.number().min(0).max(1).optional()
});

type ChatbotResponsePayload_Schema = z.infer<typeof ChatbotResponseSchema>;

const defaultModel: AiModel = env.OPENAI_API_KEY
  ? { provider: 'openai', model: 'gpt-4', temperature: 0.7 }
  : { provider: 'gemini', model: 'gemini-pro', temperature: 0.7 };

/**
 * Chatbot AI Service
 * Handles AI-powered responses with context management and streaming support
 */
export class ChatbotAiService extends BaseAiService {
  constructor() {
    super(defaultModel);
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
          context: JSON.stringify(context.recentMessages.slice(-5)),
          userMessage
        },
        ChatbotResponseSchema
      );

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        sessionId,
        messageId,
        content: response.response,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        context: this.updateContext(context, userMessage, response.response),
        metadata: {
          provider:
            this.defaultModel.provider === 'openai' ? 'OPENAI' : 'GEMINI',
          confidence: response.confidence || 0.8
        }
      };
    } catch (error) {
      logger.error({ error, sessionId }, 'Chatbot AI error');
      throw new Error(
        `Failed to generate chatbot response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build system prompt with context awareness
   */
  private buildSystemPrompt(context: ChatbotContext): string {
    const userProfile = context.userProfile
      ? `\nUser: ${context.userProfile.name || 'Guest'}, Role: ${context.userProfile.role || 'Not specified'}, Level: ${context.userProfile.level || 'Not specified'}`
      : '\nUser: Anonymous';

    const phase = `\nConversation Phase: ${context.conversationPhase}`;

    return `You are a professional AI career coach and advisor. You provide thoughtful, actionable advice on career development, skill building, and professional growth.${userProfile}${phase}

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
