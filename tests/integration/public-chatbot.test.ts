import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const aiMocks = vi.hoisted(() => ({
  generatePublicResponse: vi.fn()
}));

vi.mock('@modules/chatbot/services/chatbot-ai.service.js', () => ({
  ChatbotAiService: class {
    static createInitialContext(userProfile?: any) {
      return {
        recentMessages: [],
        userProfile,
        conversationPhase: 'greeting',
        sessionMetadata: {
          startedAt: '2026-05-15T00:00:00.000Z'
        }
      };
    }

    generatePublicResponse(userMessage: string, sessionId: string, context: any) {
      return aiMocks.generatePublicResponse(userMessage, sessionId, context);
    }
  }
}));

import { app } from '@/app/app.js';
import { env } from '@config/env.js';
import { prismaMock } from '../mocks/prisma.mock.js';

describe('Public homepage chatbot', () => {
  beforeEach(() => {
    aiMocks.generatePublicResponse.mockResolvedValue({
      sessionId: 'public_test_session',
      messageId: 'public_message_id',
      content: 'Focus your resume on one target role, then align projects and keywords to that role.',
      role: 'assistant',
      timestamp: '2026-05-15T00:00:00.000Z',
      metadata: {
        confidence: 0.82,
        provider: 'GROQ'
      }
    });
  });

  it('allows unauthenticated visitors to ask a stateless public career question', async () => {
    const response = await request(app)
      .post(`${env.API_PREFIX}/chatbot/public-message`)
      .send({
        content: 'How can I improve my resume?',
        recentMessages: [
          {
            role: 'assistant',
            content: 'Ask me about resumes, jobs, career roadmaps, or interviews.'
          }
        ]
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: 'public_message_id',
      role: 'assistant',
      content:
        'Focus your resume on one target role, then align projects and keywords to that role.',
      timestamp: '2026-05-15T00:00:00.000Z'
    });
    expect(aiMocks.generatePublicResponse).toHaveBeenCalledWith(
      'How can I improve my resume?',
      expect.stringMatching(/^public_/),
      expect.objectContaining({
        recentMessages: [
          {
            role: 'assistant',
            content: 'Ask me about resumes, jobs, career roadmaps, or interviews.'
          }
        ],
        sessionMetadata: expect.objectContaining({
          public: true,
          persistence: 'none'
        })
      })
    );
    expect(prismaMock.chatbotSession.create).not.toHaveBeenCalled();
    expect(prismaMock.chatbotMessage.create).not.toHaveBeenCalled();
  });

  it('rejects invalid public assistant payloads before AI execution', async () => {
    const response = await request(app)
      .post(`${env.API_PREFIX}/chatbot/public-message`)
      .send({ content: 'x' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Please send a valid career question.');
    expect(aiMocks.generatePublicResponse).not.toHaveBeenCalled();
  });
});
