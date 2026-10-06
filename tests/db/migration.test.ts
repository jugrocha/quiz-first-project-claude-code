import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_SCORE, TOTAL_QUESTIONS } from '@/lib/scoring';

// The games migration duplicates scoring limits as CHECK constraints. These
// tests keep the SQL and src/lib/scoring.ts from drifting apart.
const sql = readFileSync(
  path.resolve(__dirname, '../../supabase/migrations/20261005120000_create_games.sql'),
  'utf8',
);

describe('games migration', () => {
  it('limits question_ids to TOTAL_QUESTIONS', () => {
    expect(sql).toContain(`cardinality(question_ids) = ${TOTAL_QUESTIONS}`);
  });

  it('limits current_index and correct_count to TOTAL_QUESTIONS', () => {
    expect(sql).toContain(`current_index between 0 and ${TOTAL_QUESTIONS}`);
    expect(sql).toContain(`correct_count between 0 and ${TOTAL_QUESTIONS}`);
    expect(sql).toContain(`current_index = ${TOTAL_QUESTIONS}`);
  });

  it('caps score at MAX_SCORE', () => {
    expect(sql).toContain(`score between 0 and ${MAX_SCORE}`);
  });

  it('enables RLS and revokes the public API roles', () => {
    expect(sql).toContain('alter table public.games enable row level security');
    expect(sql).toContain('revoke all on public.games from anon, authenticated');
    expect(sql).not.toMatch(/create policy/i);
  });
});
