import { prisma } from '@config/prisma.js';
import type { Prisma, ChatbotMessage as PrismaChatbotMessage, ChatbotSession as PrismaChatbotSession } from '@prisma/client';
import type {
  ChatbotSessionResponse,
  ChatbotMessage,
  ChatbotContext,
  GetSessionsQuery
} from '../types/chatbot.types.js';

/**
 * Chatbot Repository - REBUILT
 * Single source of truth for chatbot sessions and messages.
 * Uses ONLY the relational chatbot_messages table.
 */
export const chatbotRepository = {
  /**
   * Create a new chatbot session
   */
  async createSession(data: {
    userId: string;
    title?: string;
    context?: ChatbotContext;
  }): Promise<PrismaChatbotSession> {
    return prisma.chatbotSession.create({
      data: {
        userId: data.userId,
        title: data.title,
        context: (data.context ?? {
          recentMessages: [],
          conversationPhase: 'greeting'
        }) as unknown as Prisma.JsonObject,
        messages: [] as Prisma.JsonArray // Matches schema field name
      }
    });
  },

  /**
   * Add a message to session (Relational only)
   */
  async addMessage(sessionId: string, message: Omit<ChatbotMessage, 'id' | 'timestamp'>): Promise<PrismaChatbotMessage> {
    const newMessage = await prisma.chatbotMessage.create({
      data: {
        sessionId,
        role: message.role,
        content: message.content,
        metadata: (message.metadata as Prisma.JsonObject) || undefined
      }
    });

    await prisma.chatbotSession.update({
      where: { id: sessionId },
      data: {
        lastMessageAt: new Date(),
        updatedAt: new Date()
      }
    });

    return newMessage;
  },

  /**
   * Get session by ID with relational messages
   */
  async getSessionById(sessionId: string, userId?: string): Promise<ChatbotSessionResponse | null> {
    const session = await prisma.chatbotSession.findUnique({
      where: { id: sessionId },
      include: {
        messageList: {
          orderBy: { createdAt: 'desc' }, // Get newest first for hydration
          take: 50 
        }
      }
    });

    if (!session || (userId && session.userId !== userId)) {
      return null;
    }

    // Restore chronological order for DTO
    if (session.messageList) {
      session.messageList.reverse();
    }

    return this.mapSessionToResponse(session);
  },

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string, query: GetSessionsQuery = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query;
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      prisma.chatbotSession.findMany({
        where: {
          userId,
          deletedAt: null
        },
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder as Prisma.SortOrder
        },
        include: {
          messageList: {
            orderBy: { createdAt: 'desc' },
            take: 1 // Fetch only last message for summary
          }
        }
      }),
      prisma.chatbotSession.count({
        where: {
          userId,
          deletedAt: null
        }
      })
    ]);

    return {
      sessions: sessions.map((s) => this.mapSessionToResponse(s)),
      total,
      page,
      limit
    };
  },

  /**
   * Get messages from relational table ONLY
   */
  async getSessionMessages(sessionId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.chatbotMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit
      }),
      prisma.chatbotMessage.count({
        where: { sessionId }
      })
    ]);

    const mappedMessages: ChatbotMessage[] = messages.map((m: PrismaChatbotMessage) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.createdAt.toISOString(),
      metadata: (m.metadata as unknown as ChatbotMessage['metadata']) || undefined
    }));

    return {
      messages: mappedMessages,
      total,
      page,
      limit
    };
  },

  /**
   * Update session context
   */
  async updateSessionContext(sessionId: string, context: ChatbotContext): Promise<void> {
    await prisma.chatbotSession.update({
      where: { id: sessionId },
      data: {
        context: context as unknown as Prisma.JsonObject,
        updatedAt: new Date()
      }
    });
  },

  /**
   * Update session title
   */
  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await prisma.chatbotSession.update({
      where: { id: sessionId },
      data: {
        title,
        updatedAt: new Date()
      }
    });
  },

  /**
   * Delete session (soft delete)
   */
  async deleteSession(sessionId: string): Promise<void> {
    await prisma.chatbotSession.update({
      where: { id: sessionId },
      data: {
        deletedAt: new Date()
      }
    });
  },

  /**
   * Create AI feedback record
   */
  async createAiFeedback(data: {
    userId: string;
    chatbotSessionId: string;
    type: 'CHATBOT_RESPONSE';
    provider: 'OPENAI' | 'GEMINI';
    summary?: string;
    suggestions?: unknown;
  }): Promise<void> {
    await prisma.aiFeedback.create({
      data: {
        userId: data.userId,
        chatbotSessionId: data.chatbotSessionId,
        type: 'CHATBOT_RESPONSE',
        provider: data.provider,
        status: 'COMPLETED',
        summary: data.summary,
        suggestions: (data.suggestions as Prisma.JsonObject) || {}
      }
    });
  },

  /**
   * Mapper: Database -> DTO
   * IGNORES legacy messages field entirely.
   */
  mapSessionToResponse(session: PrismaChatbotSession & { messageList?: PrismaChatbotMessage[] }): ChatbotSessionResponse {
    const relationalMessages: ChatbotMessage[] = (session.messageList || []).map((m: PrismaChatbotMessage) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.createdAt.toISOString(),
      metadata: (m.metadata as unknown as ChatbotMessage['metadata']) || undefined
    }));

    return {
      id: session.id,
      userId: session.userId,
      title: session.title || undefined,
      messageCount: relationalMessages.length,
      lastMessage: relationalMessages[relationalMessages.length - 1]?.content,
      lastMessageAt: session.lastMessageAt?.toISOString(),
      context: (session.context as unknown as ChatbotContext) || undefined,
      messages: relationalMessages,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
    };
  }
};
