export type AiProviderName = 'groq' | 'chatbot-groq';

export type AiModel = {
  provider: AiProviderName;
  model: string;
  maxTokens?: number;
  temperature?: number;
};

export type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiCompletionRequest = {
  model: AiModel;
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
  signal?: AbortSignal;
};

export type AiCompletionResponse = {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
};

export type AiError = {
  code: string;
  message: string;
  provider: AiProviderName;
  retryable: boolean;
};
