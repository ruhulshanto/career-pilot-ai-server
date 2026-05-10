import type { ProcessingStatus, AiProvider } from '@prisma/client';

/**
 * Represents a single message in a chatbot conversation
 */
export interface ChatbotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO 8601 format
  metadata?: {
    tokens?: number;
    provider?: AiProvider;
  };
}

/**
 * Stores conversation context for AI model
 */
export interface ChatbotContext {
  recentMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  userProfile?: {
    name: string;
    role?: string;
    level?: string;
  };
  conversationPhase: 'greeting' | 'exploration' | 'advice' | 'action_planning';
  sessionMetadata?: Record<string, any>;
}

/**
 * Database model DTO for API responses
 */
export interface ChatbotSessionResponse {
  id: string;
  userId: string;
  title?: string;
  messageCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
  context?: ChatbotContext;
  messages: ChatbotMessage[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Request body to create a new chatbot session
 */
export interface CreateSessionRequest {
  title?: string;
  context?: {
    userProfile?: {
      name?: string;
      role?: string;
      level?: string;
    };
  };
}

/**
 * Request body to send a message
 */
export interface SendMessageRequest {
  content: string;
  context?: Record<string, any>;
}

/**
 * Response from AI chatbot with streaming support
 */
export interface ChatbotResponsePayload {
  sessionId: string;
  messageId: string;
  content: string;
  role: 'assistant';
  timestamp: string;
  context?: ChatbotContext;
  metadata?: {
    provider?: AiProvider;
    tokens?: number;
    confidence?: number;
  };
}

/**
 * Streaming chunk for chunked transfer encoding
 */
export interface StreamingChunk {
  type: 'start' | 'content' | 'context_update' | 'end';
  data: any;
}

/**
 * Query parameters for listing sessions
 */
export interface GetSessionsQuery {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'lastMessageAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Query parameters for listing messages in a session
 */
export interface GetMessagesQuery {
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Request for rate limiting
 */
export interface RateLimitConfig {
  maxMessagesPerMinute: number;
  maxSessionsPerDay: number;
  windowMs: number;
}
