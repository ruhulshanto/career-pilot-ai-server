import {
  addJobWithContext,
  createSafeJobId,
  getAnalyticsQueue
} from '@queues/index.js';
import { getConfiguredPrismaAiProvider } from '@config/ai.js';
import { getRedis } from '@config/redis.js';
import { chatbotRepository } from '@modules/chatbot/repositories/chatbot.repository.js';
import { careerContextService } from '@modules/career/services/career-context.service.js';
import { createPaginationMeta } from '@shared/helpers/pagination.js';
import { ApiError } from '@shared/errors/api-error.js';
import { ChatbotAiService } from './chatbot-ai.service.js';
import type {
  ChatbotSessionResponse,
  ChatbotContext,
  CreateSessionRequest,
  ChatbotResponsePayload,
  SendMessageRequest,
  GetSessionsQuery,
  GetMessagesQuery
} from '../types/chatbot.types.js';

type PublicChatMessage = Pick<ChatbotContext['recentMessages'][number], 'role' | 'content'>;

/**
 * Chatbot Service - REBUILT
 * Focus: Orchestration, Business Rules, AI Hand-off.
 * Source of Truth: Relational Database (via Repository).
 */
export const chatbotService = {
  /**
   * Generate a lightweight public assistant reply without creating sessions,
   * database messages, queue jobs, Redis streams, or analytics records.
   */
  async sendPublicMessage(payload: {
    content: string;
    recentMessages?: PublicChatMessage[];
  }): Promise<ChatbotResponsePayload> {
    const context = ChatbotAiService.createInitialContext({
      name: 'Homepage visitor',
      role: 'Career explorer',
      level: 'General'
    });

    context.recentMessages = (payload.recentMessages ?? []).slice(-6);
    context.careerContext = {
      nextAction: {
        label:
          'Create a free Career Pilot AI workspace to save chat history, resume analysis, roadmaps, and interview practice.'
      }
    };
    context.sessionMetadata = {
      ...context.sessionMetadata,
      public: true,
      persistence: 'none'
    };

    const publicSessionId = `public_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    const aiService = new ChatbotAiService();

    return aiService.generatePublicResponse(
      payload.content,
      publicSessionId,
      context
    );
  },

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
    initialContext.careerContext = {};

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

    const hydratedSession = await chatbotRepository.getSessionById(
      session.id,
      userId
    );
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
    context.careerContext = (await careerContextService.getCareerContext(
      userId
    )) as unknown as Record<string, any>;

    // Async hand-off to AI worker
    await addJobWithContext(
      'ai-processing',
      'generate-chatbot-response',
      {
        task: 'generate-chatbot-response',
        data: {
          sessionId,
          userId,
          userMessage: payload.content,
          context
        }
      },
      {
        jobId: createSafeJobId(
          'chatbot',
          'response',
          sessionId,
          userMessage.id
        ),
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    );

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
      pagination: createPaginationMeta(page, limit, total)
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
      pagination: createPaginationMeta(page, limit, total)
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
  async handleAiResponse(
    sessionId: string,
    userId: string,
    aiResponse: {
      messageId: string;
      content: string;
      timestamp: string;
      metadata?: any;
      context?: ChatbotContext;
    }
  ) {
    // Save assistant message to DB
    await chatbotRepository.addMessage(sessionId, {
      role: 'assistant',
      content: aiResponse.content,
      metadata: aiResponse.metadata
    });

    // Real-time broadcast
    const redis = getRedis();
    const channel = `session:${sessionId}:messages`;
    const assistantMessage = {
      id: aiResponse.messageId,
      role: 'assistant',
      content: aiResponse.content,
      timestamp: aiResponse.timestamp,
      metadata: aiResponse.metadata
    };
    await redis.publish(channel, JSON.stringify(assistantMessage));
    await redis.publish(
      channel,
      JSON.stringify({
        type: 'done',
        sessionId,
        messageId: aiResponse.messageId,
        timestamp: aiResponse.timestamp
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
      provider:
        aiResponse.metadata?.provider || getConfiguredPrismaAiProvider(),
      suggestions: aiResponse.context
    });
  }
};
