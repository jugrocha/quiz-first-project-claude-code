import { describe, expect, it } from 'vitest';
import {
  drawGameQuestions,
  loadQuestions,
  toPublicQuestion,
  validateQuestionBank,
} from '@/lib/questions';
import { QuestionSchema, type Question } from '@/types/question';
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

  it('has exactly 6 questions per level in the current seed', () => {
    const questions = loadQuestions();
    for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
      expect(questions.filter((q) => q.level === level)).toHaveLength(6);
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
