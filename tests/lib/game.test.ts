import { describe, expect, it } from 'vitest';
import { evaluateAnswer, isTimeout, secondsLeft } from '@/lib/game';

describe('secondsLeft', () => {
  it.each([
    [0, 15],
    [10_000, 5],
    [14_999, 0],
    [15_000, 0],
    [16_500, 0], // inside the tolerance window, but the nominal 15s is already up
  ])('elapsed=%i -> secondsLeft=%i', (elapsed, expected) => {
    expect(secondsLeft(elapsed)).toBe(expected);
  });
});

describe('isTimeout', () => {
  it('allows exactly 15s + 2s tolerance', () => {
    expect(isTimeout(17_000)).toBe(false);
  });

  it('flags 1ms past the tolerance as a timeout', () => {
    expect(isTimeout(17_001)).toBe(true);
  });
});

describe('evaluateAnswer', () => {
  const shownAt = new Date('2026-01-01T00:00:00.000Z');

  it('scores a correct, fast answer with a speed bonus', () => {
    const result = evaluateAnswer({
      level: 'beginner',
      correctAnswer: true,
      submittedAnswer: true,
      questionShownAt: shownAt,
      answeredAt: new Date(shownAt.getTime() + 1_000),
    });
    expect(result.correct).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.pointsAwarded).toBeGreaterThan(10); // base(10) + bonus
  });

  it('scores a correct answer within tolerance but after 15s with no bonus', () => {
    const result = evaluateAnswer({
      level: 'beginner',
      correctAnswer: true,
      submittedAnswer: true,
      questionShownAt: shownAt,
      answeredAt: new Date(shownAt.getTime() + 16_500),
    });
    expect(result.correct).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.pointsAwarded).toBe(10); // base only, no bonus
  });

  it('awards 0 points for an incorrect answer regardless of timing', () => {
    const result = evaluateAnswer({
      level: 'advanced',
      correctAnswer: true,
      submittedAnswer: false,
      questionShownAt: shownAt,
      answeredAt: new Date(shownAt.getTime() + 1_000),
    });
    expect(result.correct).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });

  it('treats a null submitted answer as a timeout with 0 points', () => {
    const result = evaluateAnswer({
      level: 'advanced',
      correctAnswer: true,
      submittedAnswer: null,
      questionShownAt: shownAt,
      answeredAt: new Date(shownAt.getTime() + 500),
    });
    expect(result.timedOut).toBe(true);
    expect(result.correct).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });

  it('treats an answer arriving beyond the tolerance as a timeout even if it matches', () => {
    const result = evaluateAnswer({
      level: 'advanced',
      correctAnswer: true,
      submittedAnswer: true,
      questionShownAt: shownAt,
      answeredAt: new Date(shownAt.getTime() + 17_001),
    });
    expect(result.timedOut).toBe(true);
    expect(result.correct).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });
});
