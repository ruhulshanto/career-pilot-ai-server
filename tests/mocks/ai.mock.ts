import { vi } from 'vitest';

export const mockAiResponse = {
  content: 'Mocked AI response',
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  finishReason: 'stop'
};

export const aiClientMock = {
  complete: vi.fn().mockResolvedValue(mockAiResponse),
};

vi.mock('@ai/clients/ai-client.js', () => ({
  AiClient: vi.fn().mockImplementation(() => aiClientMock),
}));
