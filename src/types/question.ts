import { z } from 'zod';

export const LevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type Level = z.infer<typeof LevelSchema>;

export const CategorySchema = z.enum(['fundamentos', 'features', 'api-sdk', 'boas-praticas']);
export type Category = z.infer<typeof CategorySchema>;

export const QuestionSchema = z.object({
  id: z.string().min(1),
  level: LevelSchema,
  category: CategorySchema,
  statement: z.string().min(10),
  answer: z.boolean(),
  explanation: z.string().min(10),
  docUrl: z.string().url().optional(),
});
export type Question = z.infer<typeof QuestionSchema>;

export const QuestionsArraySchema = z.array(QuestionSchema);

/**
 * Client-safe projection of a Question. Never includes `answer`, `explanation`
 * or `docUrl` — those must only reach the client after the question has been
 * answered. See CLAUDE.md: "A test must assert that no answer key leaks."
 */
export const PublicQuestionSchema = QuestionSchema.pick({
  id: true,
  statement: true,
  level: true,
  category: true,
});
export type PublicQuestion = z.infer<typeof PublicQuestionSchema>;
