import { BaseAiService } from '@ai/services/base.js';
import { AiModel } from '@ai/types.js';
import { env } from '@config/env.js';
import { z } from 'zod';
import { logger } from '@/logging/logger.js';

const InterviewQuestionSchema = z.object({
  questionId: z.string(),
  prompt: z.string(),
  answer: z.string().optional()
});

const InterviewQuestionsSchema = z.object({
  questions: z.array(InterviewQuestionSchema)
});

const InterviewFeedbackSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggestions: z.array(z.string()),
  score: z.number().min(0).max(100)
});

export type InterviewQuestionPayload = z.infer<typeof InterviewQuestionSchema>;
export type InterviewFeedbackPayload = z.infer<typeof InterviewFeedbackSchema>;

const defaultModel: AiModel = env.OPENAI_API_KEY
  ? { provider: 'openai', model: 'gpt-4', temperature: 0.7 }
  : { provider: 'gemini', model: 'gemini-pro', temperature: 0.7 };

export class InterviewAiService extends BaseAiService {
  constructor() {
    super(defaultModel);
  }

  async generateInterviewQuestions(
    title: string,
    roleTarget: string,
    level: string | undefined,
    questionCount: number
  ): Promise<InterviewQuestionPayload[]> {
    try {
      const response = await this.executePromptWithSchema(
        'interview-question-generation',
        {
          title,
          roleTarget,
          level: level ?? 'general',
          questionCount
        },
        InterviewQuestionsSchema
      );

      return response.questions;
    } catch (error) {
      logger.warn(
        { error, title, roleTarget },
        'Interview question generation AI fallback'
      );
      return this.createFallbackQuestions(
        title,
        roleTarget,
        level,
        questionCount
      );
    }
  }

  async generateInterviewFeedback(
    title: string,
    roleTarget: string,
    level: string | undefined,
    questions: InterviewQuestionPayload[],
    transcript: string
  ): Promise<InterviewFeedbackPayload> {
    try {
      const questionAnswerPairs = questions
        .map(
          (question) =>
            `Question: ${question.prompt}\nAnswer: ${question.answer ?? 'No answer provided'}`
        )
        .join('\n\n');

      const response = await this.executePromptWithSchema(
        'interview-feedback-summary',
        {
          title,
          roleTarget,
          level: level ?? 'general',
          questionAnswerPairs: `${questionAnswerPairs}\n\nTranscript:\n${transcript}`
        },
        InterviewFeedbackSchema
      );

      return response;
    } catch (error) {
      logger.warn(
        { error, title, roleTarget },
        'Interview feedback generation AI fallback'
      );
      return this.createFallbackFeedback(questions, transcript);
    }
  }

  private createFallbackQuestions(
    title: string,
    roleTarget: string,
    level: string | undefined,
    questionCount: number
  ): InterviewQuestionPayload[] {
    const normalizedLevel = level ? `${level} level` : 'general level';
    return Array.from({ length: questionCount }, (_, index) => ({
      questionId: `q-${index + 1}`,
      prompt: `Describe a scenario in which you demonstrated strong ${roleTarget} skills for a ${title} interview at a ${normalizedLevel}.`
    }));
  }

  private createFallbackFeedback(
    questions: InterviewQuestionPayload[],
    transcript: string
  ): InterviewFeedbackPayload {
    const answered = questions.filter(
      (question) => question.answer && question.answer.trim().length > 0
    );
    const detailScore = Math.min(100, Math.max(30, answered.length * 15));
    return {
      summary: answered.length
        ? 'The candidate provided thoughtful responses and demonstrated an understanding of the role.'
        : 'The candidate needs to provide more complete answers before the interview can be evaluated.',
      strengths: answered.length
        ? [
            'Clear response structure',
            'Relevant examples',
            'Consistent preparation'
          ]
        : ['Willingness to participate'],
      weaknesses:
        answered.length < questions.length
          ? [
              'Some questions were not answered in full',
              'More depth is needed on core topics'
            ]
          : ['Responses could use more concrete metrics and examples'],
      suggestions: [
        'Use specific examples to support your answers.',
        'Quantify your accomplishments where possible.',
        'Practice clear structure: situation, task, action, result.'
      ],
      score: detailScore
    };
  }
}
