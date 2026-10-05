import type { Level } from '@/types/question';

export const QUESTION_TIME_LIMIT_SECONDS = 15;
export const TIMEOUT_TOLERANCE_SECONDS = 2;
export const QUESTIONS_PER_BAND = 5;
export const TOTAL_QUESTIONS = QUESTIONS_PER_BAND * 3;

export const BASE_POINTS: Record<Level, number> = {
  beginner: 10,
  intermediate: 15,
  advanced: 20,
};

// Max per-question score at secondsLeft=15: base + floor(base*0.5) -> 15/22/30.
// 5*15 + 5*22 + 5*30 = 335. Asserted against the formula in tests, not just
// trusted as a literal here.
export const MAX_SCORE = 335;

/**
 * floor(base * 0.5 * secondsLeft / 15), with secondsLeft clamped to [0, 15].
 */
export function speedBonus(base: number, secondsLeft: number): number {
  const clamped = Math.max(0, Math.min(QUESTION_TIME_LIMIT_SECONDS, secondsLeft));
  return Math.floor((base * 0.5 * clamped) / QUESTION_TIME_LIMIT_SECONDS);
}

export function scoreAnswer(params: {
  level: Level;
  correct: boolean;
  secondsLeft: number;
}): number {
  if (!params.correct) return 0;
  const base = BASE_POINTS[params.level];
  return base + speedBonus(base, params.secondsLeft);
}

export type Classification =
  'Curioso' | 'Praticante' | 'Especialista' | 'Mestre' | 'Lenda do Claude Code';

/**
 * Classification by correct answers out of 15:
 * 0-5 Curioso, 6-9 Praticante, 10-12 Especialista, 13-14 Mestre, 15 Lenda do Claude Code.
 */
export function classify(correctCount: number): Classification {
  if (correctCount >= 15) return 'Lenda do Claude Code';
  if (correctCount >= 13) return 'Mestre';
  if (correctCount >= 10) return 'Especialista';
  if (correctCount >= 6) return 'Praticante';
  return 'Curioso';
}

export interface RankingEntry {
  score: number;
  totalTimeMs: number;
  createdAt: Date;
}

/**
 * Ranking tie-break: higher score first, then lower total time, then older date.
 */
export function compareRankingEntries(a: RankingEntry, b: RankingEntry): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs;
  return a.createdAt.getTime() - b.createdAt.getTime();
}
