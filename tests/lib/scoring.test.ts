import { describe, expect, it } from 'vitest';
import {
  BASE_POINTS,
  MAX_SCORE,
  QUESTIONS_PER_BAND,
  classify,
  compareRankingEntries,
  scoreAnswer,
  speedBonus,
  type RankingEntry,
} from '@/lib/scoring';

describe('speedBonus / scoreAnswer', () => {
  it('awards base + 50% bonus at secondsLeft=15', () => {
    expect(speedBonus(10, 15)).toBe(5);
    expect(scoreAnswer({ level: 'beginner', correct: true, secondsLeft: 15 })).toBe(15);
  });

  it('awards exactly base at secondsLeft=0', () => {
    expect(speedBonus(10, 0)).toBe(0);
    expect(scoreAnswer({ level: 'beginner', correct: true, secondsLeft: 0 })).toBe(10);
  });

  it('awards 0 for an incorrect answer regardless of secondsLeft', () => {
    expect(scoreAnswer({ level: 'advanced', correct: false, secondsLeft: 15 })).toBe(0);
    expect(scoreAnswer({ level: 'advanced', correct: false, secondsLeft: 0 })).toBe(0);
  });

  it('clamps secondsLeft outside [0, 15]', () => {
    expect(speedBonus(10, -5)).toBe(speedBonus(10, 0));
    expect(speedBonus(10, 100)).toBe(speedBonus(10, 15));
  });
});

describe('MAX_SCORE', () => {
  it('matches the formula: 5 questions per band, full bonus, 3 bands', () => {
    const perBandMax = (level: keyof typeof BASE_POINTS) => {
      const base = BASE_POINTS[level];
      return QUESTIONS_PER_BAND * (base + speedBonus(base, 15));
    };
    const total = perBandMax('beginner') + perBandMax('intermediate') + perBandMax('advanced');
    expect(total).toBe(MAX_SCORE);
    expect(MAX_SCORE).toBe(335);
  });
});

describe('classify', () => {
  it.each([
    [0, 'Curioso'],
    [5, 'Curioso'],
    [6, 'Praticante'],
    [9, 'Praticante'],
    [10, 'Especialista'],
    [12, 'Especialista'],
    [13, 'Mestre'],
    [14, 'Mestre'],
    [15, 'Lenda do Claude Code'],
  ] as const)('classifies %i correct answers as %s', (correctCount, expected) => {
    expect(classify(correctCount)).toBe(expected);
  });
});

describe('compareRankingEntries', () => {
  const entry = (overrides: Partial<RankingEntry>): RankingEntry => ({
    score: 100,
    totalTimeMs: 60_000,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });

  it('ranks higher score first', () => {
    const a = entry({ score: 200 });
    const b = entry({ score: 100 });
    expect(compareRankingEntries(a, b)).toBeLessThan(0);
    expect(compareRankingEntries(b, a)).toBeGreaterThan(0);
  });

  it('breaks a score tie by lower total time', () => {
    const faster = entry({ totalTimeMs: 50_000 });
    const slower = entry({ totalTimeMs: 90_000 });
    expect(compareRankingEntries(faster, slower)).toBeLessThan(0);
  });

  it('breaks a score+time tie by older date', () => {
    const older = entry({ createdAt: new Date('2025-01-01T00:00:00Z') });
    const newer = entry({ createdAt: new Date('2026-01-01T00:00:00Z') });
    expect(compareRankingEntries(older, newer)).toBeLessThan(0);
  });

  it('sorts a mixed array in the expected order', () => {
    const entries: RankingEntry[] = [
      entry({ score: 100, totalTimeMs: 10_000, createdAt: new Date('2026-01-01T00:00:00Z') }),
      entry({ score: 200, totalTimeMs: 90_000, createdAt: new Date('2026-01-01T00:00:00Z') }),
      entry({ score: 200, totalTimeMs: 50_000, createdAt: new Date('2026-01-01T00:00:00Z') }),
      entry({ score: 200, totalTimeMs: 50_000, createdAt: new Date('2025-01-01T00:00:00Z') }),
    ];
    const sorted = [...entries].sort(compareRankingEntries);
    expect(sorted.map((e) => [e.score, e.totalTimeMs, e.createdAt.getUTCFullYear()])).toEqual([
      [200, 50_000, 2025],
      [200, 50_000, 2026],
      [200, 90_000, 2026],
      [100, 10_000, 2026],
    ]);
  });
});
