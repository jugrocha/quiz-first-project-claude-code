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

/**
 * Bank-level invariants that don't fit the per-item zod schema.
 *
 * NOTE: SEED_MIN_PER_LEVEL (4) is a floor for the current placeholder seed
 * data (src/data/questions.json). The PRD's real target is >=10 per level
 * (section 11.3) — raise this once the bank is grown (roadmap step 8).
 */
const SEED_MIN_PER_LEVEL = 4;

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
    if (count < SEED_MIN_PER_LEVEL) {
      throw new Error(`Level ${level} has only ${count} questions (min ${SEED_MIN_PER_LEVEL})`);
    }
  }
}

export interface DrawOptions {
  /** Injectable RNG (must return a float in [0, 1)) for deterministic tests. */
  random?: () => number;
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
): Question[] {
  const shuffled = shuffle(pool, random);
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
 * per band, order within a band shuffled.
 */
export function drawGameQuestions(allQuestions: Question[], options: DrawOptions = {}): Question[] {
  const random = options.random ?? Math.random;
  return LEVELS.flatMap((level) =>
    drawBand(
      allQuestions.filter((q) => q.level === level),
      5,
      2,
      random,
    ),
  );
}

export function toPublicQuestion(q: Question): PublicQuestion {
  return PublicQuestionSchema.parse(q);
}
