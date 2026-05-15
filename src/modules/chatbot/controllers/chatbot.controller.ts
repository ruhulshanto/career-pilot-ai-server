import { asyncHandler } from '@shared/utils/async-handler.js';
import { chatbotService } from '@modules/chatbot/services/chatbot.service.js';
import {
  createSessionSchema,
  publicMessageSchema,
  sendMessageSchema,
  getSessionsQuerySchema,
  getMessagesQuerySchema,
  updateSessionSchema
} from '@modules/chatbot/validations/chatbot.validation.js';
import { getRedis } from '@config/redis.js';
import type { Request, Response } from 'express';

const writeSseEvent = (res: Response, event: string, data: unknown) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

/**
 * Chatbot Controller
 * Handles HTTP requests for chatbot endpoints
 */
export const chatbotController = {
  /**
   * POST /api/chatbot/public-message
   * Generate a stateless public homepage assistant reply.
   */
  sendPublicMessage: asyncHandler(async (req: Request, res: Response) => {
    const result = publicMessageSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Please send a valid career question.',
        details: result.error.flatten()
      });
    }

    const reply = await chatbotService.sendPublicMessage(result.data);

    res.status(200).json({
      success: true,
      data: {
        id: reply.messageId,
        role: reply.role,
        content: reply.content,
        timestamp: reply.timestamp,
        metadata: {
          confidence: reply.metadata?.confidence,
          fallback: reply.metadata?.fallback,
          reason: reply.metadata?.reason,
          retryAfterMs: reply.metadata?.retryAfterMs,
          structured: reply.metadata?.structured
        }
      }
    });
  }),

  /**
   * POST /api/chatbot/sessions
   * Create a new chatbot session
   */
  createSession: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = createSessionSchema.safeParse(req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ error: 'Invalid request', details: result.error });
    }

    const session = await chatbotService.createSession(userId, result.data);

    res.status(201).json({
      success: true,
      data: session
    });
  }),

  /**
   * GET /api/chatbot/sessions
   * Get all chatbot sessions for user
   */
  getSessions: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const queryResult = getSessionsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res
        .status(400)
        .json({ error: 'Invalid query', details: queryResult.error });
    }
    const query = queryResult.data;
    const result = await chatbotService.getSessions(userId, query);

    res.status(200).json({
      success: true,
      ...result
    });
  }),

  /**
   * GET /api/chatbot/sessions/:sessionId
   * Get specific chatbot session with messages
   */
  getSession: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.params as { sessionId: string };
    const session = await chatbotService.getSession(userId, sessionId);

    res.status(200).json({
      success: true,
      data: session
    });
  }),

  /**
   * GET /api/chatbot/sessions/:sessionId/messages
   * Get messages from session (paginated)
   */
  getSessionMessages: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.params as { sessionId: string };
    const queryResult = getMessagesQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res
        .status(400)
        .json({ error: 'Invalid query', details: queryResult.error });
    }
    const query = queryResult.data;
    const result = await chatbotService.getSessionMessages(
      userId,
      sessionId,
      query
    );

    res.status(200).json({
      success: true,
      ...result
    });
  }),

  /**
   * POST /api/chatbot/sessions/:sessionId/messages
   * Send a message to chatbot
   */
  sendMessage: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.params as { sessionId: string };
    const result = sendMessageSchema.safeParse(req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ error: 'Invalid request', details: result.error });
    }
    const payload = result.data;
    const message = await chatbotService.sendMessage(
      userId,
      sessionId,
      payload
    );

    res.status(201).json({
      success: true,
      data: message
    });
  }),

  /**
   * PATCH /api/chatbot/sessions/:sessionId
   * Update chatbot session (title, context)
   */
  updateSession: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.params as { sessionId: string };
    const payload = updateSessionSchema.safeParse(req.body);
    if (!payload.success) {
      return res
        .status(400)
        .json({ error: 'Invalid request', details: payload.error });
    }
    const updates = payload.data as any;
    const session = await chatbotService.updateSession(
      userId,
      sessionId,
      updates
    );

    res.status(200).json({
      success: true,
      data: session
    });
  }),

  /**
   * DELETE /api/chatbot/sessions/:sessionId
   * Delete chatbot session
   */
  deleteSession: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.params as { sessionId: string };
    await chatbotService.deleteSession(userId, sessionId);

    res.status(200).json({
      success: true,
      message: 'Session deleted successfully'
    });
  }),

  /**
   * GET /api/chatbot/sessions/:sessionId/stream
   * Stream messages for a session using SSE
   */
  streamMessages: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.params as { sessionId: string };
    const session = await chatbotService.getSession(userId, sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const redis = getRedis().duplicate();
    const channel = `session:${sessionId}:messages`;
    const keepAlive = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 25000);

    await redis.subscribe(channel);

    redis.on('message', (chan, message) => {
      if (chan === channel) {
        try {
          const payload = JSON.parse(message) as { type?: string };

          if (payload.type === 'done') {
            writeSseEvent(res, 'done', payload);
            return;
          }

          writeSseEvent(res, 'message', payload);
          return;
        } catch {
          res.write('event: message\n');
          res.write(`data: ${message}\n\n`);
        }
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
      redis.disconnect();
    });
  })
};
