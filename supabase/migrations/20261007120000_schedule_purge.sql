-- Run purge_unsaved_games() every day at 04:00 UTC, so abandoned and unsaved
-- games older than 7 days don't pile up. pg_cron is available on every
-- Supabase project, including the Free plan.
create extension if not exists pg_cron with schema pg_catalog;

-- cron.schedule with an existing job name updates that job, so re-running
-- this is harmless.
select cron.schedule(
  'purge-unsaved-games',
  '0 4 * * *',
  $$select public.purge_unsaved_games()$$
);
