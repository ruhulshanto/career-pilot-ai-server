import { BaseAiService } from '@ai/services/base.js';
import '@ai/prompts/resume.prompts.js';
import { getDefaultAiModel } from '@config/ai.js';
import { z } from 'zod';

export const ResumeAnalysisSchema = z.object({
  atsScore: z.number().min(0).max(100),
  roleFitScore: z.number().min(0).max(100),
  inferredTargetRole: z.string().min(2).max(150),
  experienceLevel: z.string().min(2).max(100),
  summary: z.string().min(1),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  missingSkills: z.array(z.string()).optional(),
  improvementSuggestions: z.array(z.string()).optional(),
  keywordGaps: z.array(z.string()).optional(),
  recommendedNextActions: z.array(z.string()).optional()
});

type ResumeAnalysisAiResponse = z.infer<typeof ResumeAnalysisSchema>;

export type ResumeAnalysisPayload = ResumeAnalysisAiResponse & {
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  improvementSuggestions: string[];
  keywordGaps: string[];
  recommendedNextActions: string[];
};

export class ResumeAiService extends BaseAiService {
  constructor() {
    super(getDefaultAiModel('resume', { temperature: 0.2, maxTokens: 4096 }));
  }

  async analyzeResume(input: {
    title: string;
    fileType: string;
    resumeText: string;
  }): Promise<ResumeAnalysisPayload> {
    const analysis = await this.executePromptWithSchema(
      'resume-analysis',
      {
        title: input.title,
        fileType: input.fileType,
        resumeText: input.resumeText
      },
      ResumeAnalysisSchema
    );

    return {
      ...analysis,
      strengths: analysis.strengths ?? [],
      weaknesses: analysis.weaknesses ?? [],
      missingSkills: analysis.missingSkills ?? [],
      improvementSuggestions: analysis.improvementSuggestions ?? [],
      keywordGaps: analysis.keywordGaps ?? [],
      recommendedNextActions: analysis.recommendedNextActions ?? []
    };
  }
}
