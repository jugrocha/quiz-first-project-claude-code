-- Game state + ranking (PRD section 9).
-- A row is created when a game starts; the ranking is the set of rows with
-- saved_at is not null. All access goes through the service role on the
-- server, so RLS is enabled with no policies.
--
-- The limits below (15 questions, max score 335) mirror TOTAL_QUESTIONS and
-- MAX_SCORE in src/lib/scoring.ts as a last line of defense against forged
-- scores. tests/db/migration.test.ts fails if the two drift apart; changing
-- the scoring rules means adding a new migration that updates these checks.

create table public.games (
  id uuid primary key default gen_random_uuid(),
  -- 15 question ids in game order
  question_ids text[] not null check (cardinality(question_ids) = 15),
  -- [{questionId, answer, correct, points, shownAt, answeredAt, timedOut}]
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  current_index int not null default 0 check (current_index between 0 and 15),
  question_shown_at timestamptz,
  score int not null default 0 check (score between 0 and 335),
  correct_count int not null default 0 check (correct_count between 0 and 15),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- Total game time, derived so the ranking can order/index on it directly.
  duration_ms bigint generated always as (
    (extract(epoch from (finished_at - started_at)) * 1000)::bigint
  ) stored,
  nickname text check (nickname ~ '^[A-Za-z0-9_-]{3,20}$'),
  saved_at timestamptz,

  -- A game can only be saved once it is finished, and only with a nickname.
  constraint games_saved_requires_finished check (
    saved_at is null or (finished_at is not null and nickname is not null)
  ),
  constraint games_finished_requires_all_answered check (
    finished_at is null or current_index = 15
  )
);

-- Ranking: higher score, then lower total time, then older date.
create index games_ranking_idx
  on public.games (score desc, duration_ms asc, finished_at asc)
  where saved_at is not null;

-- Supports purge_unsaved_games below.
create index games_unsaved_started_idx
  on public.games (started_at)
  where saved_at is null;

alter table public.games enable row level security;
-- No policies: only the service role (server) can read or write. Also revoke
-- the default grants so a policy added by mistake later still can't expose
-- the table to the public API keys.
revoke all on public.games from anon, authenticated;

-- Abandoned or unsaved games are never needed once they're stale, so the
-- table doesn't have to grow forever. Run manually with
--   select public.purge_unsaved_games();
-- or schedule it on Supabase Cloud with pg_cron (see README).
create function public.purge_unsaved_games(older_than interval default interval '7 days')
returns integer
language sql
security invoker
set search_path = ''
as $$
  with deleted as (
    delete from public.games
    where saved_at is null
      and started_at < now() - older_than
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke execute on function public.purge_unsaved_games(interval) from public, anon, authenticated;
grant execute on function public.purge_unsaved_games(interval) to service_role;
