import 'server-only';

import rawQuestions from '@/data/questions.json';
import {
  QuestionsArraySchema,
  PublicQuestionSchema,
  type Question,
  type PublicQuestion,
  type Level,
} from '@/types/question';

const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];

export function loadQuestions(): Question[] {
  return QuestionsArraySchema.parse(rawQuestions);
}

/** Bank-level invariants that don't fit the per-item zod schema (PRD 11.3). */
export const MIN_PER_LEVEL = 10;

export function validateQuestionBank(questions: Question[]): void {
  const ids = new Set<string>();
  for (const q of questions) {
    if (ids.has(q.id)) {
      throw new Error(`Duplicate question id: ${q.id}`);
    }
    ids.add(q.id);
  }

  for (const level of LEVELS) {
    const count = questions.filter((q) => q.level === level).length;
    if (count < MIN_PER_LEVEL) {
      throw new Error(`Level ${level} has only ${count} questions (min ${MIN_PER_LEVEL})`);
    }
  }
}

export interface DrawOptions {
  /** Injectable RNG (must return a float in [0, 1)) for deterministic tests. */
  random?: () => number;
  /**
   * Ids the player has already seen this session (RF-11). They are drawn only
   * when there aren't enough unseen questions to fill a band.
   */
  seen?: ReadonlySet<string>;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Draws `count` questions from `pool`, shuffled, with at most `categoryCap`
 * questions per category. Throws if the pool can't satisfy the balance.
 */
function drawBand(
  pool: Question[],
  count: number,
  categoryCap: number,
  random: () => number,
  seen: ReadonlySet<string>,
): Question[] {
  // Unseen questions first, each group shuffled.
  const shuffled = shuffle(pool, random).sort(
    (a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)),
  );
  const picked: Question[] = [];
  const categoryCounts = new Map<string, number>();

  for (const q of shuffled) {
    if (picked.length >= count) break;
    const used = categoryCounts.get(q.category) ?? 0;
    if (used >= categoryCap) continue;
    picked.push(q);
    categoryCounts.set(q.category, used + 1);
  }

  if (picked.length < count) {
    throw new Error('Not enough questions to satisfy category balance for this band');
  }

  return picked;
}

/**
 * Draws the 15 questions for a game: 5 beginner + 5 intermediate + 5 advanced,
 * in that fixed band order. No repeats within a game, at most 2 per category
 * per band, unseen questions preferred, order within a band shuffled.
 */
export function drawGameQuestions(allQuestions: Question[], options: DrawOptions = {}): Question[] {
  const random = options.random ?? Math.random;
  const seen = options.seen ?? new Set<string>();
  return LEVELS.flatMap((level) => {
    const band = drawBand(
      allQuestions.filter((q) => q.level === level),
      5,
      2,
      random,
      seen,
    );
    // The greedy pick visits unseen questions first; shuffle again so seen
    // fillers don't always land at the end of the band.
    return shuffle(band, random);
  });
}

export function toPublicQuestion(q: Question): PublicQuestion {
  return PublicQuestionSchema.parse(q);
}
