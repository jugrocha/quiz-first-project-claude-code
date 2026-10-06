import { describe, expect, it, vi } from 'vitest';
import {
  createMemoryGameStore,
  createResilientGameStore,
  StorageError,
  type GameRecord,
  type SupabaseGameStore,
} from '@/lib/game-store';

const NEW_GAME = {
  questionIds: Array.from({ length: 15 }, (_, i) => `q${i}`),
  startedAt: '2026-10-06T12:00:00.000Z',
  questionShownAt: '2026-10-06T12:00:00.000Z',
};

const down = () => Promise.reject(new StorageError('Supabase is down'));

/** A Supabase store whose every call fails unless overridden. */
function failingPrimary(overrides: Partial<SupabaseGameStore> = {}): SupabaseGameStore {
  return {
    create: down,
    get: down,
    markShown: down,
    recordAnswer: down,
    save: down,
    insertSaved: down,
    rankOf: down,
    topRanking: down,
    ...overrides,
  };
}

async function finish(store: ReturnType<typeof createMemoryGameStore>, id: string) {
  await store.recordAnswer(id, 0, {
    answers: [],
    currentIndex: 15,
    score: 100,
    correctCount: 8,
    finishedAt: '2026-10-06T12:03:00.000Z',
  });
}

describe('memory store guards', () => {
  it('applies an answer only at the expected index', async () => {
    const store = createMemoryGameStore();
    const game = await store.create(NEW_GAME);
    const update = { answers: [], currentIndex: 1, score: 10, correctCount: 1, finishedAt: null };

    expect(await store.recordAnswer(game.id, 0, update)).toBe(true);
    expect(await store.recordAnswer(game.id, 0, update)).toBe(false);
    expect((await store.get(game.id))?.questionShownAt).toBeNull();
  });

  it('marks a question shown only once', async () => {
    const store = createMemoryGameStore();
    const game = await store.create({ ...NEW_GAME, questionShownAt: null });
    expect(await store.markShown(game.id, 0, 'first')).toBe(true);
    expect(await store.markShown(game.id, 0, 'second')).toBe(false);
    expect((await store.get(game.id))?.questionShownAt).toBe('first');
  });

  it('computes the duration when the game finishes', async () => {
    const store = createMemoryGameStore();
    const game = await store.create(NEW_GAME);
    await finish(store, game.id);
    expect((await store.get(game.id))?.durationMs).toBe(180_000);
  });
});

describe('resilient store (Supabase down)', () => {
  it('creates and plays the game in memory when Supabase fails', async () => {
    const memory = createMemoryGameStore();
    const store = createResilientGameStore(failingPrimary(), memory);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const game = await store.create(NEW_GAME);
    expect(memory.has(game.id)).toBe(true);
    expect(await store.get(game.id)).toMatchObject({ id: game.id, currentIndex: 0 });
    expect(
      await store.recordAnswer(game.id, 0, {
        answers: [],
        currentIndex: 1,
        score: 10,
        correctCount: 1,
        finishedAt: null,
      }),
    ).toBe(true);
  });

  it('rethrows non-storage errors instead of hiding bugs', async () => {
    const boom = new TypeError('bug');
    const store = createResilientGameStore(
      failingPrimary({ create: () => Promise.reject(boom) }),
      createMemoryGameStore(),
    );
    await expect(store.create(NEW_GAME)).rejects.toBe(boom);
  });

  it('a failed save of an in-memory game can be retried once Supabase is back', async () => {
    const memory = createMemoryGameStore();
    const inserted: GameRecord[] = [];
    let supabaseUp = false;
    const primary = failingPrimary({
      async insertSaved(game) {
        if (!supabaseUp) throw new StorageError('still down');
        inserted.push(game);
      },
    });
    const store = createResilientGameStore(primary, memory);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const game = await store.create(NEW_GAME);
    await finish(memory, game.id);

    await expect(store.save(game.id, 'jogador', '2026-10-06T12:04:00.000Z')).rejects.toThrow(
      StorageError,
    );
    expect((await memory.get(game.id))?.savedAt).toBeNull();

    supabaseUp = true;
    expect(await store.save(game.id, 'jogador', '2026-10-06T12:05:00.000Z')).toBe(true);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ id: game.id, nickname: 'jogador', score: 100 });
    // Now lives in Supabase only.
    expect(memory.has(game.id)).toBe(false);
  });

  it('a second save of an in-memory game is rejected without touching Supabase', async () => {
    const memory = createMemoryGameStore();
    const insertSaved = vi.fn(() => new Promise<void>(() => {})); // never resolves
    const store = createResilientGameStore(failingPrimary({ insertSaved }), memory);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const game = await store.create(NEW_GAME);
    await finish(memory, game.id);

    void store.save(game.id, 'primeiro', '2026-10-06T12:04:00.000Z');
    expect(await store.save(game.id, 'segundo', '2026-10-06T12:04:00.000Z')).toBe(false);
    expect(insertSaved).toHaveBeenCalledTimes(1);
  });
});
