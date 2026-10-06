import 'server-only';

import { compareRankingEntries } from '@/lib/scoring';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { parseStoredAnswers, type GameRow, type StoredAnswer } from '@/types/database';

/**
 * Persistence for games behind one interface, so the game rules
 * (lib/game-service.ts) don't care where a game lives:
 *
 * - Supabase (`games` table) when it is configured and reachable.
 * - In memory when Supabase isn't configured, or when creating a game in
 *   Supabase fails, so a game stays playable while the database is down
 *   (CLAUDE.md). Saving such a game copies it into Supabase; if that still
 *   fails the save errors and can be retried.
 *
 * Every mutation is a guarded compare-and-set: it applies only if the game is
 * still in the expected state and returns false otherwise, so two concurrent
 * requests can't both succeed.
 */

export type GameRecord = {
  id: string;
  questionIds: string[];
  answers: StoredAnswer[];
  currentIndex: number;
  /** When the current question was shown; null until /next shows it. */
  questionShownAt: string | null;
  score: number;
  correctCount: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  nickname: string | null;
  savedAt: string | null;
};

export type NewGame = Pick<GameRecord, 'questionIds' | 'startedAt' | 'questionShownAt'>;

export type AnswerUpdate = Pick<
  GameRecord,
  'answers' | 'currentIndex' | 'score' | 'correctCount' | 'finishedAt'
>;

export type RankingRow = {
  nickname: string;
  score: number;
  correctCount: number;
  durationMs: number;
};

export interface GameStore {
  create(game: NewGame): Promise<GameRecord>;
  get(id: string): Promise<GameRecord | null>;
  /** Sets questionShownAt if the game is at `index` and it isn't set yet. */
  markShown(id: string, index: number, shownAt: string): Promise<boolean>;
  /** Applies an answer if the game is still at `expectedIndex`; clears questionShownAt. */
  recordAnswer(id: string, expectedIndex: number, update: AnswerUpdate): Promise<boolean>;
  /** Saves to the ranking if the game is finished and not saved yet. */
  save(id: string, nickname: string, savedAt: string): Promise<boolean>;
  /** 1-based ranking position of a saved game. */
  rankOf(game: GameRecord): Promise<number>;
  topRanking(limit: number): Promise<RankingRow[]>;
}

/** The database could not be reached or rejected the query. */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}

function durationOf(startedAt: string, finishedAt: string | null): number | null {
  return finishedAt === null ? null : Date.parse(finishedAt) - Date.parse(startedAt);
}

function toRankingEntry(game: GameRecord) {
  return {
    score: game.score,
    totalTimeMs: game.durationMs ?? 0,
    createdAt: new Date(game.finishedAt ?? game.startedAt),
  };
}

// ---------------------------------------------------------------------------
// In memory

export interface MemoryGameStore extends GameStore {
  has(id: string): boolean;
  delete(id: string): void;
  /** Undoes save() so a failed copy to Supabase can be retried. */
  unsave(id: string): void;
}

export function createMemoryGameStore(): MemoryGameStore {
  const games = new Map<string, GameRecord>();
  const copyOf = (game: GameRecord): GameRecord => ({ ...game, answers: [...game.answers] });

  const savedGames = () =>
    [...games.values()]
      .filter((game) => game.savedAt !== null)
      .sort((a, b) => compareRankingEntries(toRankingEntry(a), toRankingEntry(b)));

  return {
    async create(game) {
      const record: GameRecord = {
        id: crypto.randomUUID(),
        questionIds: [...game.questionIds],
        answers: [],
        currentIndex: 0,
        questionShownAt: game.questionShownAt,
        score: 0,
        correctCount: 0,
        startedAt: game.startedAt,
        finishedAt: null,
        durationMs: null,
        nickname: null,
        savedAt: null,
      };
      games.set(record.id, record);
      return copyOf(record);
    },
    async get(id) {
      const game = games.get(id);
      return game ? copyOf(game) : null;
    },
    async markShown(id, index, shownAt) {
      const game = games.get(id);
      if (!game || game.currentIndex !== index || game.questionShownAt !== null) return false;
      game.questionShownAt = shownAt;
      return true;
    },
    async recordAnswer(id, expectedIndex, update) {
      const game = games.get(id);
      if (!game || game.currentIndex !== expectedIndex) return false;
      Object.assign(game, update, {
        answers: [...update.answers],
        questionShownAt: null,
        durationMs: durationOf(game.startedAt, update.finishedAt),
      });
      return true;
    },
    async save(id, nickname, savedAt) {
      const game = games.get(id);
      if (!game || game.finishedAt === null || game.savedAt !== null) return false;
      game.nickname = nickname;
      game.savedAt = savedAt;
      return true;
    },
    async rankOf(game) {
      return savedGames().findIndex((saved) => saved.id === game.id) + 1;
    },
    async topRanking(limit) {
      return savedGames()
        .slice(0, limit)
        .map((game) => ({
          nickname: game.nickname ?? '',
          score: game.score,
          correctCount: game.correctCount,
          durationMs: game.durationMs ?? 0,
        }));
    },
    has: (id) => games.has(id),
    delete: (id) => void games.delete(id),
    unsave(id) {
      const game = games.get(id);
      if (game) {
        game.nickname = null;
        game.savedAt = null;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Supabase

function fromRow(row: GameRow): GameRecord {
  return {
    id: row.id,
    questionIds: row.question_ids,
    answers: parseStoredAnswers(row.answers),
    currentIndex: row.current_index,
    questionShownAt: row.question_shown_at,
    score: row.score,
    correctCount: row.correct_count,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    nickname: row.nickname,
    savedAt: row.saved_at,
  };
}

type QueryResult<T> = { data: T | null; error: { message: string } | null };

/** Unwraps a supabase-js result, turning any error into a StorageError. */
function check<T>(result: QueryResult<T>, action: string): T | null {
  if (result.error) throw new StorageError(`Supabase ${action} failed: ${result.error.message}`);
  return result.data;
}

/** For guarded updates: whether the update matched (and changed) a row. */
function matched(result: QueryResult<unknown[]>, action: string): boolean {
  return (check(result, action) ?? []).length > 0;
}

export interface SupabaseGameStore extends GameStore {
  /** Inserts a finished, already-saved game (used to persist in-memory games). */
  insertSaved(game: GameRecord): Promise<void>;
}

export function createSupabaseGameStore(): SupabaseGameStore {
  const db = () => getSupabase();

  return {
    async create(game) {
      const row = check(
        await db()
          .from('games')
          .insert({
            question_ids: game.questionIds,
            started_at: game.startedAt,
            question_shown_at: game.questionShownAt,
          })
          .select()
          .single(),
        'create',
      );
      if (!row) throw new StorageError('Supabase create returned no row');
      return fromRow(row);
    },
    async get(id) {
      const row = check(await db().from('games').select().eq('id', id).maybeSingle(), 'get');
      return row ? fromRow(row) : null;
    },
    async markShown(id, index, shownAt) {
      return matched(
        await db()
          .from('games')
          .update({ question_shown_at: shownAt })
          .eq('id', id)
          .eq('current_index', index)
          .is('question_shown_at', null)
          .select('id'),
        'markShown',
      );
    },
    async recordAnswer(id, expectedIndex, update) {
      return matched(
        await db()
          .from('games')
          .update({
            answers: update.answers,
            current_index: update.currentIndex,
            score: update.score,
            correct_count: update.correctCount,
            finished_at: update.finishedAt,
            question_shown_at: null,
          })
          .eq('id', id)
          .eq('current_index', expectedIndex)
          .select('id'),
        'recordAnswer',
      );
    },
    async save(id, nickname, savedAt) {
      return matched(
        await db()
          .from('games')
          .update({ nickname, saved_at: savedAt })
          .eq('id', id)
          .is('saved_at', null)
          .not('finished_at', 'is', null)
          .select('id'),
        'save',
      );
    },
    async insertSaved(game) {
      check(
        await db().from('games').insert({
          id: game.id,
          question_ids: game.questionIds,
          answers: game.answers,
          current_index: game.currentIndex,
          question_shown_at: null,
          score: game.score,
          correct_count: game.correctCount,
          started_at: game.startedAt,
          finished_at: game.finishedAt,
          nickname: game.nickname,
          saved_at: game.savedAt,
        }),
        'insertSaved',
      );
    },
    async rankOf(game) {
      // Games strictly ahead under the tie-break: higher score, then lower
      // total time, then older finish. Timestamps are quoted for PostgREST.
      const s = game.score;
      const d = game.durationMs;
      const f = `"${game.finishedAt}"`;
      const result = await db()
        .from('games')
        .select('id', { count: 'exact', head: true })
        .not('saved_at', 'is', null)
        .or(
          `score.gt.${s},and(score.eq.${s},duration_ms.lt.${d}),and(score.eq.${s},duration_ms.eq.${d},finished_at.lt.${f})`,
        );
      check(result, 'rankOf');
      return (result.count ?? 0) + 1;
    },
    async topRanking(limit) {
      const rows = check(
        await db()
          .from('games')
          .select('nickname, score, correct_count, duration_ms')
          .not('saved_at', 'is', null)
          .order('score', { ascending: false })
          .order('duration_ms', { ascending: true })
          .order('finished_at', { ascending: true })
          .limit(limit),
        'topRanking',
      );
      return (rows ?? []).map((row) => ({
        nickname: row.nickname ?? '',
        score: row.score,
        correctCount: row.correct_count,
        durationMs: row.duration_ms ?? 0,
      }));
    },
  };
}

// ---------------------------------------------------------------------------
// Supabase with in-memory fallback

export function createResilientGameStore(
  primary: SupabaseGameStore,
  fallback: MemoryGameStore,
): GameStore {
  const storeFor = (id: string): GameStore => (fallback.has(id) ? fallback : primary);

  return {
    async create(game) {
      try {
        return await primary.create(game);
      } catch (error) {
        if (!(error instanceof StorageError)) throw error;
        console.warn('Supabase unavailable, playing this game in memory', error.message);
        return fallback.create(game);
      }
    },
    async get(id) {
      return (await fallback.get(id)) ?? primary.get(id);
    },
    markShown: (id, index, shownAt) => storeFor(id).markShown(id, index, shownAt),
    recordAnswer: (id, expectedIndex, update) =>
      storeFor(id).recordAnswer(id, expectedIndex, update),
    async save(id, nickname, savedAt) {
      if (!fallback.has(id)) return primary.save(id, nickname, savedAt);
      // In-memory game: claim the save locally first (atomic, single-threaded),
      // then copy the finished game into Supabase so it reaches the ranking.
      if (!(await fallback.save(id, nickname, savedAt))) return false;
      const game = await fallback.get(id);
      try {
        await primary.insertSaved(game!);
      } catch (error) {
        fallback.unsave(id);
        throw error;
      }
      fallback.delete(id);
      return true;
    },
    rankOf: (game) => primary.rankOf(game),
    topRanking: (limit) => primary.topRanking(limit),
  };
}

let store: GameStore | null = null;

export function getGameStore(): GameStore {
  store ??= isSupabaseConfigured()
    ? createResilientGameStore(createSupabaseGameStore(), createMemoryGameStore())
    : createMemoryGameStore();
  return store;
}

/** Tests only: replace (or with null, reset) the process-wide store. */
export function setGameStoreForTesting(next: GameStore | null): void {
  store = next;
}
