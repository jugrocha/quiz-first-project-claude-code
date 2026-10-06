import { z } from 'zod';

/**
 * Hand-written to match supabase/migrations. Once the local stack is running
 * this can be regenerated with `npx supabase gen types typescript --local`.
 *
 * Use `type` aliases, not `interface`: supabase-js checks these against
 * `Record<string, unknown>`, which interfaces don't satisfy, and the client
 * then silently types every row as `never`. tests/types/database.test.ts
 * guards this.
 */

/**
 * One entry of `games.answers`. The database only guarantees the column is a
 * JSON array, so rows read back must be parsed with this schema (see
 * parseStoredAnswers) rather than trusted.
 */
export const StoredAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.boolean().nullable(),
  correct: z.boolean(),
  points: z.number().int().min(0),
  shownAt: z.iso.datetime({ offset: true }),
  answeredAt: z.iso.datetime({ offset: true }),
  timedOut: z.boolean(),
});
export type StoredAnswer = z.infer<typeof StoredAnswerSchema>;

export const StoredAnswersSchema = z.array(StoredAnswerSchema);

export function parseStoredAnswers(value: unknown): StoredAnswer[] {
  return StoredAnswersSchema.parse(value);
}

export type GameRow = {
  id: string;
  question_ids: string[];
  /** Unvalidated JSON from the database; run it through parseStoredAnswers. */
  answers: unknown;
  current_index: number;
  question_shown_at: string | null;
  score: number;
  correct_count: number;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  nickname: string | null;
  saved_at: string | null;
};

type GameInsert = Partial<Omit<GameRow, 'duration_ms' | 'answers'>> &
  Pick<GameRow, 'question_ids'> & { answers?: StoredAnswer[] };
type GameUpdate = Partial<Omit<GameRow, 'id' | 'duration_ms' | 'answers'>> & {
  answers?: StoredAnswer[];
};

export type Database = {
  public: {
    Tables: {
      games: {
        Row: GameRow;
        Insert: GameInsert;
        Update: GameUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      purge_unsaved_games: {
        Args: { older_than?: string };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
