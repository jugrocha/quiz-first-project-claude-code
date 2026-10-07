import { describe, expect, it } from 'vitest';
import {
  MIN_PER_LEVEL,
  drawGameQuestions,
  loadQuestions,
  toPublicQuestion,
  validateQuestionBank,
} from '@/lib/questions';
import { CategorySchema, LevelSchema, QuestionSchema, type Question } from '@/types/question';
import { buildQuestionPool } from '../fixtures/questions.fixture';

const validQuestion: Question = {
  id: 'q-1',
  level: 'beginner',
  category: 'fundamentos',
  statement: 'This is a valid self-contained statement.',
  answer: true,
  explanation: 'This explains why the statement is true.',
};

describe('QuestionSchema', () => {
  it('accepts a valid question', () => {
    expect(QuestionSchema.safeParse(validQuestion).success).toBe(true);
  });

  it('accepts a valid docUrl', () => {
    const result = QuestionSchema.safeParse({
      ...validQuestion,
      docUrl: 'https://docs.claude.com/x',
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ['empty statement', { ...validQuestion, statement: 'short' }],
    ['empty explanation', { ...validQuestion, explanation: '' }],
    ['invalid level', { ...validQuestion, level: 'expert' }],
    ['invalid category', { ...validQuestion, category: 'random' }],
    ['non-boolean answer', { ...validQuestion, answer: 'true' }],
    ['invalid docUrl', { ...validQuestion, docUrl: 'not-a-url' }],
  ])('rejects %s', (_label, invalid) => {
    expect(QuestionSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('loadQuestions', () => {
  it('loads the real seed file without throwing', () => {
    expect(() => loadQuestions()).not.toThrow();
  });
});

/** PRD 11.3 targets for the real bank. */
describe('question bank content', () => {
  const questions = loadQuestions();

  it('has 30-50 questions in total, about half of them true', () => {
    expect(questions.length).toBeGreaterThanOrEqual(30);
    expect(questions.length).toBeLessThanOrEqual(50);
    const trueShare = questions.filter((q) => q.answer).length / questions.length;
    expect(trueShare).toBeGreaterThanOrEqual(0.45);
    expect(trueShare).toBeLessThanOrEqual(0.55);
  });

  it.each(LevelSchema.options)(
    '%s: enough questions, about 50/50 true/false, every category',
    (level) => {
      const pool = questions.filter((q) => q.level === level);
      expect(pool.length).toBeGreaterThanOrEqual(MIN_PER_LEVEL);
      const trueShare = pool.filter((q) => q.answer).length / pool.length;
      expect(trueShare).toBeGreaterThanOrEqual(0.4);
      expect(trueShare).toBeLessThanOrEqual(0.6);
      expect(new Set(pool.map((q) => q.category))).toEqual(new Set(CategorySchema.options));
    },
  );

  it('links every question to the official Claude Code docs', () => {
    for (const q of questions) {
      expect(q.docUrl, q.id).toMatch(/^https:\/\/code\.claude\.com\/docs\/en\//);
    }
  });

  it('keeps statements short enough to read within the 15 s timer', () => {
    for (const q of questions) {
      expect(q.statement.length, q.id).toBeLessThanOrEqual(160);
    }
  });

  it('draws a valid game from the real bank', () => {
    for (let i = 0; i < 200; i++) {
      expect(drawGameQuestions(questions)).toHaveLength(15);
    }
  });
});

describe('validateQuestionBank', () => {
  it('passes for a valid bank', () => {
    expect(() => validateQuestionBank(loadQuestions())).not.toThrow();
  });

  it('throws on a duplicate id', () => {
    const questions = [validQuestion, { ...validQuestion }];
    expect(() => validateQuestionBank(questions)).toThrow(/duplicate/i);
  });

  it('throws when a level is below the minimum', () => {
    expect(() => validateQuestionBank([validQuestion])).toThrow(/beginner/i);
  });
});

describe('drawGameQuestions', () => {
  const pool = buildQuestionPool(20);

  it('always draws 15 questions, 5 per band, in beginner->intermediate->advanced order', () => {
    for (let i = 0; i < 200; i++) {
      const drawn = drawGameQuestions(pool, { random: Math.random });
      expect(drawn).toHaveLength(15);
      expect(drawn.slice(0, 5).every((q) => q.level === 'beginner')).toBe(true);
      expect(drawn.slice(5, 10).every((q) => q.level === 'intermediate')).toBe(true);
      expect(drawn.slice(10, 15).every((q) => q.level === 'advanced')).toBe(true);
    }
  });

  it('never repeats an id within a draw, across many iterations', () => {
    for (let i = 0; i < 200; i++) {
      const drawn = drawGameQuestions(pool, { random: Math.random });
      const ids = new Set(drawn.map((q) => q.id));
      expect(ids.size).toBe(drawn.length);
    }
  });

  it('never exceeds 2 questions of the same category within a single band', () => {
    for (let i = 0; i < 200; i++) {
      const drawn = drawGameQuestions(pool, { random: Math.random });
      for (const band of [drawn.slice(0, 5), drawn.slice(5, 10), drawn.slice(10, 15)]) {
        const counts = new Map<string, number>();
        for (const q of band) {
          counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
        }
        for (const count of counts.values()) {
          expect(count).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('prefers questions not seen yet', () => {
    const beginners = pool.filter((q) => q.level === 'beginner');
    // 15 of the 20 beginners were seen: the 5 unseen ones must all be drawn.
    const seen = new Set(beginners.slice(0, 15).map((q) => q.id));
    const unseen = beginners.slice(15).map((q) => q.id);
    for (let i = 0; i < 100; i++) {
      const band = drawGameQuestions(pool, { seen }).slice(0, 5);
      expect(band.map((q) => q.id).sort()).toEqual([...unseen].sort());
    }
  });

  it('falls back to seen questions when there are not enough unseen ones', () => {
    const seen = new Set(pool.map((q) => q.id));
    const drawn = drawGameQuestions(pool, { seen });
    expect(drawn).toHaveLength(15);
    expect(new Set(drawn.map((q) => q.id)).size).toBe(15);
  });

  it('throws a clear error if the pool cannot satisfy the category balance', () => {
    const tinyPool = buildQuestionPool(20).filter(
      (q) => q.level !== 'beginner' || q.category === 'fundamentos',
    );
    expect(() => drawGameQuestions(tinyPool, { random: Math.random })).toThrow(
      /not enough questions/i,
    );
  });
});

describe('toPublicQuestion (no answer-key leak)', () => {
  it('only exposes id, statement, level and category', () => {
    const publicQuestion = toPublicQuestion(validQuestion);
    expect(Object.keys(publicQuestion).sort()).toEqual(['category', 'id', 'level', 'statement']);
  });

  it('never serializes the answer or explanation', () => {
    const publicQuestion = toPublicQuestion(validQuestion);
    const serialized = JSON.stringify(publicQuestion);
    expect(serialized).not.toContain('"answer"');
    expect(serialized).not.toContain('"explanation"');
  });
});
