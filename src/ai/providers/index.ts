import type { AiProviderName } from '../types.js';
import { BaseAiProvider } from './base.js';
import { GeminiProvider } from './gemini.js';
import { OpenAiProvider } from './openai.js';

const providers = new Map<AiProviderName, BaseAiProvider>();

export const getAiProvider = (name: AiProviderName): BaseAiProvider => {
  if (!providers.has(name)) {
    switch (name) {
      case 'openai':
        providers.set(name, new OpenAiProvider());
        break;
      case 'gemini':
        providers.set(name, new GeminiProvider());
        break;
      default:
        throw new Error(`Unsupported AI provider: ${name}`);
    }
  }

  return providers.get(name)!;
};

export const getAvailableProviders = (): AiProviderName[] => {
  return ['openai', 'gemini'];
};
