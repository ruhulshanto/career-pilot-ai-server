import { logger } from '@/logging/logger.js';
import { env } from '@config/env.js';
import { AiProvider } from '@prisma/client';
import type { AiModel, AiProviderName } from '@ai/types.js';

type AiTask = 'resume' | 'interview' | 'roadmap' | 'chatbot';
export const CHATBOT_AI_PROVIDER = 'chatbot-groq' as const;

export const getConfiguredAiProvider = (): AiProviderName => env.AI_PROVIDER;

export const isGroqConfigured = () =>
  Boolean(env.GROQ_API_KEY) &&
  env.GROQ_API_KEY?.startsWith('gsk_') &&
  !env.GROQ_API_KEY?.includes('your_') &&
  !env.GROQ_API_KEY?.includes('placeholder');

export const isChatbotGroqConfigured = () =>
  Boolean(env.CHATBOT_GROQ_API_KEY) &&
  env.CHATBOT_GROQ_API_KEY?.startsWith('gsk_') &&
  !env.CHATBOT_GROQ_API_KEY?.includes('your_') &&
  !env.CHATBOT_GROQ_API_KEY?.includes('placeholder');

export const getGroqConfigurationStatus = () => ({
  configured: isGroqConfigured(),
  keyPresent: Boolean(env.GROQ_API_KEY),
  keyPrefixOk: Boolean(env.GROQ_API_KEY?.startsWith('gsk_')),
  keyLength: env.GROQ_API_KEY?.length ?? 0,
  keyLooksPlaceholder: Boolean(
    env.GROQ_API_KEY?.includes('your_') ||
    env.GROQ_API_KEY?.includes('placeholder')
  )
});

export const getChatbotGroqConfigurationStatus = () => ({
  configured: isChatbotGroqConfigured(),
  keyPresent: Boolean(env.CHATBOT_GROQ_API_KEY),
  keyPrefixOk: Boolean(env.CHATBOT_GROQ_API_KEY?.startsWith('gsk_')),
  keyLength: env.CHATBOT_GROQ_API_KEY?.length ?? 0,
  keyLooksPlaceholder: Boolean(
    env.CHATBOT_GROQ_API_KEY?.includes('your_') ||
    env.CHATBOT_GROQ_API_KEY?.includes('placeholder')
  )
});

export const getConfiguredPrismaAiProvider = (
  provider: AiProviderName = env.AI_PROVIDER
) => {
  if (provider === 'groq' || provider === CHATBOT_AI_PROVIDER)
    return AiProvider.GROQ;
  return AiProvider.GROQ;
};

export const getRoadmapAiModel = (): AiModel => ({
  provider: env.AI_PROVIDER,
  model: env.GROQ_MODEL,
  temperature: 0.25,
  maxTokens: 4096
});

export const getDefaultAiModel = (
  task: AiTask,
  options: { temperature: number; maxTokens?: number }
): AiModel => {
  if (task === 'chatbot') {
    return {
      provider: CHATBOT_AI_PROVIDER,
      model: env.CHATBOT_GROQ_MODEL,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    };
  }

  return {
    provider: env.AI_PROVIDER,
    model: env.GROQ_MODEL,
    temperature: options.temperature,
    maxTokens: options.maxTokens
  };
};

export const logAiConfiguration = () => {
  logger.info(
    {
      provider: env.AI_PROVIDER,
      model: env.GROQ_MODEL,
      roadmapProvider: env.AI_PROVIDER,
      roadmapModel: env.GROQ_MODEL,
      chatbotProvider: CHATBOT_AI_PROVIDER,
      chatbotModel: env.CHATBOT_GROQ_MODEL,
      groqConfigured: isGroqConfigured(),
      groqStatus: getGroqConfigurationStatus(),
      chatbotGroqConfigured: isChatbotGroqConfigured(),
      chatbotGroqStatus: getChatbotGroqConfigurationStatus()
    },
    'AI provider configuration loaded'
  );
};
