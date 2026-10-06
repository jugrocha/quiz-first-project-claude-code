import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ServerSupabaseClient } from '@/lib/supabase';
import { parseStoredAnswers, type GameRow, type StoredAnswer } from '@/types/database';

// Type-level guard: if src/types/database.ts stops satisfying supabase-js's
// schema shape (e.g. someone switches back to `interface`), rows are typed as
// `never` and this file fails under `npm run typecheck`. Never called: it only
// has to compile.
export async function typedClientUsage(client: ServerSupabaseClient) {
  const { data: row } = await client.from('games').select('*').single();
  expectTypeOf(row).not.toBeNever();
  expectTypeOf(row).toEqualTypeOf<GameRow | null>();

  const { data: scores } = await client.from('games').select('id, score');
  expectTypeOf(scores).toEqualTypeOf<{ id: string; score: number }[] | null>();

  // @ts-expect-error unknown columns must be rejected on insert
  await client.from('games').insert({ question_ids: [], nope: 1 });

  const { data: purged } = await client.rpc('purge_unsaved_games', { older_than: '7 days' });
  expectTypeOf(purged).toEqualTypeOf<number | null>();
}

describe('Database types', () => {
  it('is checked by tsc (see typedClientUsage above)', () => {
    expect(typeof typedClientUsage).toBe('function');
  });
});

describe('parseStoredAnswers', () => {
  const valid: StoredAnswer = {
    questionId: 'fund-001',
    answer: true,
    correct: true,
    points: 15,
    shownAt: '2026-10-06T12:00:00.000Z',
    answeredAt: '2026-10-06T12:00:03.000+00:00',
    timedOut: false,
  };

  it('accepts well-formed answers, including timeouts', () => {
    const timeout = { ...valid, answer: null, correct: false, points: 0, timedOut: true };
    expect(parseStoredAnswers([valid, timeout])).toEqual([valid, timeout]);
  });

  it('rejects malformed rows', () => {
    expect(() => parseStoredAnswers({})).toThrow();
    expect(() => parseStoredAnswers([{ ...valid, points: -1 }])).toThrow();
    expect(() => parseStoredAnswers([{ ...valid, shownAt: 'yesterday' }])).toThrow();
    expect(() => parseStoredAnswers([{ questionId: 'fund-001' }])).toThrow();
  });
});
