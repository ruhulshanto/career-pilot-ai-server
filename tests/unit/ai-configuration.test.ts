import { describe, expect, it } from 'vitest';
import {
  CHATBOT_AI_PROVIDER,
  getConfiguredPrismaAiProvider,
  getDefaultAiModel,
  getRoadmapAiModel
} from '@config/ai.js';
import { getAiProvider } from '@ai/providers/index.js';
import { AiProvider } from '@prisma/client';

describe('AI configuration routing', () => {
  it('keeps non-chatbot AI traffic on the main Groq provider', () => {
    expect(getDefaultAiModel('resume', { temperature: 0.2 }).provider).toBe(
      'groq'
    );
    expect(getDefaultAiModel('interview', { temperature: 0.7 }).provider).toBe(
      'groq'
    );
    expect(getRoadmapAiModel().provider).toBe('groq');
  });

  it('routes chatbot AI traffic to an isolated Groq provider key', () => {
    const chatbotModel = getDefaultAiModel('chatbot', { temperature: 0.7 });

    expect(chatbotModel.provider).toBe(CHATBOT_AI_PROVIDER);
    expect(chatbotModel.provider).not.toBe(getRoadmapAiModel().provider);
  });

  it('uses separate provider instances for chatbot cooldown and retries', () => {
    const mainProvider = getAiProvider('groq');
    const chatbotProvider = getAiProvider(CHATBOT_AI_PROVIDER);

    expect(chatbotProvider).not.toBe(mainProvider);
    expect(mainProvider.name).toBe('groq');
    expect(chatbotProvider.name).toBe(CHATBOT_AI_PROVIDER);
  });

  it('still stores chatbot provider metadata as the existing Prisma Groq enum', () => {
    expect(getConfiguredPrismaAiProvider(CHATBOT_AI_PROVIDER)).toBe(
      AiProvider.GROQ
    );
  });
});
