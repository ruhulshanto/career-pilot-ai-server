import type { AiMessage, AiModel } from '../types.js';

export type PromptTemplate = {
  id: string;
  name: string;
  description?: string;
  template: string;
  variables: string[];
  model: AiModel;
  systemMessage?: string;
};

export class PromptManager {
  private prompts = new Map<string, PromptTemplate>();

  register(template: PromptTemplate): void {
    this.prompts.set(template.id, template);
  }

  get(id: string): PromptTemplate | undefined {
    return this.prompts.get(id);
  }

  buildPrompt(id: string, variables: Record<string, unknown>): AiMessage[] {
    const template = this.prompts.get(id);
    if (!template) {
      throw new Error(`Prompt template '${id}' not found`);
    }

    // Validate required variables
    const missingVars = template.variables.filter((v) => !(v in variables));
    if (missingVars.length > 0) {
      throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
    }

    // Replace variables in template
    let content = template.template;
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(
        new RegExp(`\\$\\{${key}\\}`, 'g'),
        String(value)
      );
    }

    const messages: AiMessage[] = [];

    if (template.systemMessage) {
      messages.push({
        role: 'system',
        content: template.systemMessage
      });
    }

    messages.push({
      role: 'user',
      content
    });

    return messages;
  }

  list(): PromptTemplate[] {
    return Array.from(this.prompts.values());
  }
}

// Global instance
export const promptManager = new PromptManager();
