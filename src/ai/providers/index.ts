import { CHATBOT_AI_PROVIDER } from '@config/ai.js';
import { env } from '@config/env.js';
import type { AiProviderName } from '../types.js';
import { BaseAiProvider } from './base.js';
import { GroqProvider } from './groq.js';

const providers = new Map<AiProviderName, BaseAiProvider>();

export const getAiProvider = (name: AiProviderName): BaseAiProvider => {
  if (!providers.has(name)) {
    switch (name) {
      case 'groq':
        providers.set(name, new GroqProvider());
        break;
      case CHATBOT_AI_PROVIDER:
        providers.set(
          name,
          new GroqProvider({
            name: CHATBOT_AI_PROVIDER,
            apiKey: env.CHATBOT_GROQ_API_KEY,
            configurationName: 'Chatbot Groq'
          })
        );
        break;
      default:
        throw new Error(
          `Unsupported AI provider: ${name}. Groq is the enabled provider.`
        );
    }
  }

  return providers.get(name)!;
};

export const getAvailableProviders = (): AiProviderName[] => {
  return ['groq', CHATBOT_AI_PROVIDER];
};
