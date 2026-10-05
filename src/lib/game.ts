import { QUESTION_TIME_LIMIT_SECONDS, TIMEOUT_TOLERANCE_SECONDS, scoreAnswer } from '@/lib/scoring';
import type { Level } from '@/types/question';

/**
 * Pure timing/scoring functions for a single question, no DB involved.
 * Wiring these to the Supabase `games` table (question_shown_at, persisted
 * answers, etc.) is a later session — see CLAUDE.md / PRD section 13 step 4.
 */

const TIME_LIMIT_MS = QUESTION_TIME_LIMIT_SECONDS * 1000;
const TOLERANCE_MS = TIMEOUT_TOLERANCE_SECONDS * 1000;

export function elapsedMs(shownAt: Date, answeredAt: Date): number {
  return answeredAt.getTime() - shownAt.getTime();
}

/**
 * A timeout is an answer arriving strictly after the 15s limit plus the 2s
 * latency tolerance (i.e. 17000ms is still accepted, 17001ms is not).
 */
export function isTimeout(elapsed: number): boolean {
  return elapsed > TIME_LIMIT_MS + TOLERANCE_MS;
}

/**
 * Seconds left, clamped to [0, 15]. Reaches 0 once the nominal 15s window has
 * elapsed, even if still inside the grace/tolerance window.
 */
export function secondsLeft(elapsed: number): number {
  if (elapsed <= 0) return QUESTION_TIME_LIMIT_SECONDS;
  if (elapsed >= TIME_LIMIT_MS) return 0;
  return Math.floor((TIME_LIMIT_MS - elapsed) / 1000);
}

export interface EvaluateAnswerInput {
  level: Level;
  correctAnswer: boolean;
  /** null = client reported a timeout (timer hit zero). */
  submittedAnswer: boolean | null;
  questionShownAt: Date;
  answeredAt: Date;
}

export interface EvaluateAnswerResult {
  correct: boolean;
  timedOut: boolean;
  secondsLeft: number;
  pointsAwarded: number;
}

export function evaluateAnswer(input: EvaluateAnswerInput): EvaluateAnswerResult {
  const elapsed = elapsedMs(input.questionShownAt, input.answeredAt);
  const timedOut = isTimeout(elapsed) || input.submittedAnswer === null;
  const left = secondsLeft(elapsed);
  const correct = !timedOut && input.submittedAnswer === input.correctAnswer;
  const pointsAwarded = scoreAnswer({ level: input.level, correct, secondsLeft: left });

  return { correct, timedOut, secondsLeft: left, pointsAwarded };
}
