import { addJobWithContext, getAnalyticsQueue } from '@queues/index.js';
import { getRedis } from '@config/redis.js';
import { chatbotRepository } from '@modules/chatbot/repositories/chatbot.repository.js';
import { createPaginationMeta } from '@shared/helpers/pagination.js';
import { ApiError } from '@shared/errors/api-error.js';
import { ChatbotAiService } from './chatbot-ai.service.js';
import type {
  ChatbotSessionResponse,
  ChatbotContext,
  CreateSessionRequest,
  SendMessageRequest,
  GetSessionsQuery,
  GetMessagesQuery
} from '../types/chatbot.types.js';

/**
 * Chatbot Service - REBUILT
 * Focus: Orchestration, Business Rules, AI Hand-off.
 * Source of Truth: Relational Database (via Repository).
 */
export const chatbotService = {
  /**
   * Create a new chatbot session
   */
  async createSession(
    userId: string,
    payload: CreateSessionRequest
  ): Promise<ChatbotSessionResponse> {
    const initialContext = ChatbotAiService.createInitialContext(
      payload.context?.userProfile
    );

    const session = await chatbotRepository.createSession({
      userId,
      title: payload.title || `Chat Session ${new Date().toLocaleDateString()}`,
      context: initialContext
    });

    await getAnalyticsQueue().add('analytics-job', {
      event: 'chatbot_session_created',
      data: {
        userId,
        sessionId: session.id,
        title: session.title
      }
    });

    const hydratedSession = await chatbotRepository.getSessionById(session.id, userId);
    if (!hydratedSession) {
      throw new ApiError(500, 'Failed to create and hydrate chatbot session');
    }

    return hydratedSession;
  },

  /**
   * Send message and trigger AI background processing
   */
  async sendMessage(
    userId: string,
    sessionId: string,
    payload: SendMessageRequest
  ): Promise<{ sessionId: string; messageId: string; content: string }> {
    const session = await chatbotRepository.getSessionById(sessionId, userId);
    if (!session) {
      throw new ApiError(404, 'Chatbot session not found');
    }

    // Add user message to relational storage
    const userMessage = await chatbotRepository.addMessage(sessionId, {
      role: 'user',
      content: payload.content
    });

    // Prepare context for AI
    const context =
      (session.context as unknown as ChatbotContext) ||
      ChatbotAiService.createInitialContext();
      
    // Async hand-off to AI worker
    await addJobWithContext('ai-processing', 'generate-chatbot-response', {
      task: 'generate-chatbot-response',
      data: {
        sessionId,
        userId,
        userMessage: payload.content,
        context
      }
    });

    // Analytics
    await getAnalyticsQueue().add('analytics-job', {
      event: 'chatbot_message_sent',
      data: {
        userId,
        sessionId,
        messageLength: payload.content.length
      }
    });

    return {
      sessionId,
      messageId: userMessage.id,
      content: payload.content
    };
  },

  /**
   * Get all sessions for user
   */
  async getSessions(userId: string, query: GetSessionsQuery = {}) {
    const { sessions, total, page, limit } =
      await chatbotRepository.getUserSessions(userId, query);

    return {
      data: sessions,
      pagination: createPaginationMeta(total, page, limit)
    };
  },

  /**
   * Get specific session
   */
  async getSession(
    userId: string,
    sessionId: string
  ): Promise<ChatbotSessionResponse> {
    const session = await chatbotRepository.getSessionById(sessionId, userId);
    if (!session) {
      throw new ApiError(404, 'Chatbot session not found');
    }
    return session;
  },

  /**
   * Get messages (relational ONLY)
   */
  async getSessionMessages(
    userId: string,
    sessionId: string,
    query: GetMessagesQuery = {}
  ) {
    const session = await chatbotRepository.getSessionById(sessionId, userId);
    if (!session) {
      throw new ApiError(404, 'Chatbot session not found');
    }

    const { page = 1, limit = 20 } = query;
    const { messages, total } = await chatbotRepository.getSessionMessages(
      sessionId,
      page,
      limit
    );

    return {
      data: messages,
      pagination: createPaginationMeta(total, page, limit)
    };
  },

  /**
   * Update session
   */
  async updateSession(
    userId: string,
    sessionId: string,
    updates: { title?: string; context?: ChatbotContext }
  ): Promise<ChatbotSessionResponse> {
    const session = await chatbotRepository.getSessionById(sessionId, userId);
    if (!session) {
      throw new ApiError(404, 'Chatbot session not found');
    }

    if (updates.title) {
      await chatbotRepository.updateSessionTitle(sessionId, updates.title);
    }

    if (updates.context) {
      await chatbotRepository.updateSessionContext(sessionId, updates.context);
    }

    const updated = await chatbotRepository.getSessionById(sessionId, userId);
    if (!updated) {
      throw new ApiError(404, 'Session disappeared during update');
    }
    return updated;
  },

  /**
   * Delete session
   */
  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const session = await chatbotRepository.getSessionById(sessionId, userId);
    if (!session) {
      throw new ApiError(404, 'Chatbot session not found');
    }

    await chatbotRepository.deleteSession(sessionId);

    await getAnalyticsQueue().add('analytics-job', {
      event: 'chatbot_session_deleted',
      data: {
        userId,
        sessionId
      }
    });
  },

  /**
   * Worker callback for AI response
   */
  async handleAiResponse(sessionId: string, userId: string, aiResponse: {
    messageId: string;
    content: string;
    timestamp: string;
    metadata?: any;
    context?: ChatbotContext;
  }) {
    // Save assistant message to DB
    await chatbotRepository.addMessage(sessionId, {
      role: 'assistant',
      content: aiResponse.content,
      metadata: aiResponse.metadata
    });

    // Real-time broadcast
    const redis = getRedis();
    await redis.publish(
      `session:${sessionId}:messages`,
      JSON.stringify({
        id: aiResponse.messageId,
        role: 'assistant',
        content: aiResponse.content,
        timestamp: aiResponse.timestamp,
        metadata: aiResponse.metadata
      })
    );

    // Context synchronization
    if (aiResponse.context) {
      await chatbotRepository.updateSessionContext(
        sessionId,
        aiResponse.context
      );
    }

    // Feedback & Usage Tracking
    await chatbotRepository.createAiFeedback({
      userId,
      chatbotSessionId: sessionId,
      type: 'CHATBOT_RESPONSE',
      provider: aiResponse.metadata?.provider || 'OPENAI',
      suggestions: aiResponse.context
    });
  }
};
