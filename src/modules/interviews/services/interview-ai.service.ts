import { BaseAiService } from '@ai/services/base.js';
import { getDefaultAiModel } from '@config/ai.js';
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
  questionFeedback: z
    .array(
      z.object({
        questionId: z.string(),
        score: z.number().min(0).max(100),
        whatWorked: z.array(z.string()),
        improve: z.array(z.string()),
        strongerAnswer: z.string()
      })
    )
    .optional(),
  score: z.number().min(0).max(100)
});

export type InterviewQuestionPayload = z.infer<typeof InterviewQuestionSchema>;
export type InterviewFeedbackPayload = z.infer<typeof InterviewFeedbackSchema>;

const MAX_QUESTION_COUNT = 12;
const MAX_ANSWER_CHARS = 1200;
const MAX_TRANSCRIPT_CHARS = 2500;

const truncateText = (value: string | undefined, maxChars: number) => {
  if (!value) return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trim()}...`;
};

export class InterviewAiService extends BaseAiService {
  constructor() {
    super(getDefaultAiModel('interview', { temperature: 0.7 }));
  }

  async generateInterviewQuestions(
    title: string,
    roleTarget: string,
    level: string | undefined,
    questionCount: number
  ): Promise<InterviewQuestionPayload[]> {
    try {
      const normalizedQuestionCount = Math.min(
        MAX_QUESTION_COUNT,
        Math.max(1, questionCount)
      );
      const response = await this.executePromptWithSchema(
        'interview-question-generation',
        {
          title,
          roleTarget,
          level: level ?? 'general',
          questionCount: normalizedQuestionCount
        },
        InterviewQuestionsSchema
      );

      return response.questions.slice(0, normalizedQuestionCount);
    } catch (error) {
      logger.warn(
        { error, title, roleTarget },
        'Interview question generation AI fallback'
      );
      return this.createFallbackQuestions(
        title,
        roleTarget,
        level,
        Math.min(MAX_QUESTION_COUNT, Math.max(1, questionCount))
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
            `Question: ${question.prompt}\nAnswer: ${
              truncateText(question.answer, MAX_ANSWER_CHARS) ||
              'No answer provided'
            }`
        )
        .join('\n\n');

      const response = await this.executePromptWithSchema(
        'interview-feedback-summary',
        {
          title,
          roleTarget,
          level: level ?? 'general',
          questionAnswerPairs: `${questionAnswerPairs}\n\nTranscript:\n${truncateText(
            transcript,
            MAX_TRANSCRIPT_CHARS
          )}`
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
        ? 'The AI service is currently experiencing high demand, so CareerAI created a basic practice review from your answers. The candidate provided thoughtful responses and demonstrated an understanding of the role.'
        : 'The AI service is currently experiencing high demand, so CareerAI created a basic practice review. The candidate needs to provide more complete answers before the interview can be evaluated.',
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
      questionFeedback: questions.map((question, index) => ({
        questionId: question.questionId,
        score: question.answer?.trim() ? Math.min(85, 55 + index * 4) : 35,
        whatWorked: question.answer?.trim()
          ? ['The answer addresses the question directly.']
          : ['The question was included in the practice set.'],
        improve: [
          'Add a specific situation, action, and measurable result.',
          'Connect the example more clearly to the target role.'
        ],
        strongerAnswer: question.answer?.trim()
          ? 'Rewrite this answer with one concrete example, the action you personally took, and the business or team impact.'
          : 'Prepare a complete answer using the STAR structure before your next attempt.'
      })),
      score: detailScore
    };
  }
}
