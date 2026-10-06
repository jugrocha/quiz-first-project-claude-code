import type { Classification } from '@/lib/scoring';
import type { PublicQuestion } from '@/types/question';

/**
 * Response bodies of the /api routes. Kept apart from lib/game-service.ts
 * (server-only) so client components can import them.
 */

export type QuestionPayload = {
  gameId: string;
  index: number;
  total: number;
  question: PublicQuestion;
  timeLimitMs: number;
  /** Time left on this question's timer, by the server clock. */
  remainingMs: number;
  /** Points so far, so a reloaded page can show the running score. */
  score: number;
};

export type ReviewItem = {
  questionId: string;
  statement: string;
  yourAnswer: boolean | null;
  correctAnswer: boolean;
  explanation: string;
  docUrl?: string;
  timedOut: boolean;
};

export type GameSummary = {
  score: number;
  correctCount: number;
  total: number;
  durationMs: number;
  classification: Classification;
  /** Wrong and timed-out answers only. */
  review: ReviewItem[];
};

export type AnswerResult = {
  correct: boolean;
  timedOut: boolean;
  correctAnswer: boolean;
  explanation: string;
  docUrl?: string;
  points: number;
  runningScore: number;
  /** True while there are questions left; fetch the next one with POST /next. */
  hasNext: boolean;
  summary?: GameSummary;
};

export type GameResult =
  | { status: 'not_found' }
  | { status: 'in_progress' }
  | { status: 'finished'; summary: GameSummary; saved: { nickname: string; rank: number } | null };

export type RankingEntryPayload = {
  rank: number;
  nickname: string;
  score: number;
  correctCount: number;
  durationMs: number;
};
