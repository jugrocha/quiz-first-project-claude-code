# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

The project is scaffolded (Next.js App Router + TypeScript strict + Tailwind v4, ESLint, Prettier, Vitest). PRD section 13 steps 1–3 are done: tooling, the `Question` zod schema (`src/types/question.ts`), a placeholder 18-question seed bank (`src/data/questions.json` — content not yet fact-checked against docs.claude.com, see section 11.4), and the pure business-rule libraries `src/lib/scoring.ts`, `src/lib/questions.ts`, `src/lib/game.ts` with unit tests in `tests/`. Step 4 is done too: `supabase/config.toml` (from `npx supabase init`), the `games` migration in `supabase/migrations` (with a generated `duration_ms` column used for ranking order), the server-only client `src/lib/supabase.ts`, hand-written DB types in `src/types/database.ts` (must stay `type` aliases, guarded by `tests/types/database.test.ts`), and `.env.example`. `tests/db/migration.test.ts` keeps the SQL limits in sync with `lib/scoring.ts`. Docker is not installed, so development currently runs against the Supabase Cloud project (ref `gfgwkvmamzkcoxtiofkj`, CLI linked, migration applied with `npx supabase db push`); `.env.local` points at it. Step 5 is done: the Route Handlers in `src/app/api` are thin wrappers over `src/lib/game-service.ts` (game rules), `src/lib/game-store.ts` (Supabase / in-memory persistence), `src/lib/api.ts` (errors, body parsing, rate limit), `src/lib/rate-limit.ts`, `src/lib/nickname.ts` and `src/lib/copy.ts`. API tests in `tests/api` call the handlers directly against the in-memory store with fake `Date` timers. Step 6 is done: home (`src/app/page.tsx`), the game screen `/play/[gameId]` (client `src/components/QuizGame.tsx` with `TimerBar` and `FeedbackPanel`; it loads the current question via `/next` on mount, so a reload resumes with the timer still running), and the server-rendered result page `/result/[gameId]` (reads `getGameResult` directly, plus the client `SaveScoreForm`). Browser code calls the API through `src/lib/api-client.ts` and imports response types from `src/types/api.ts`, never from server-only modules. Theme tokens and their measured contrast ratios are in `src/app/globals.css`. Step 7 is done: `/ranking` (server-rendered top 20; `?partida=<gameId>` highlights the player's saved row via `getRanking({ highlightGameId })`, and game ids are never sent by `GET /api/ranking`), `ShareButton` on the result page (Web Share API, clipboard fallback, then a manual-copy textarea), and `SiteHeader` navigation. Still missing from RF-11: "play again" doesn't yet prioritize questions unseen in the session; worth doing with step 8, once the bank is large enough for it to matter. Read `prd.md` in full before continuing. Section 13 defines the remaining implementation order (steps 8–11), and section 17 is the Definition of Done.

Commands:

```
npm run dev          # start the dev server
npm run build         # production build
npm run lint          # eslint
npm run typecheck     # tsc --noEmit
npm run format         # prettier --write .
npm run format:check  # prettier --check .
npm test               # vitest run
npm run test:watch    # vitest watch mode
```

## Planned stack and commands

Next.js (App Router) + TypeScript (strict) + Tailwind, Vitest for unit/API tests, optional Playwright E2E, ESLint + Prettier. Supabase Postgres for persistence, deployed on Vercel. Local development uses the Supabase CLI (`supabase start`, requires Docker) with migrations in `supabase/migrations`. Production uses a Supabase Cloud Free project, because Vercel can't reach the local instance. CI is planned as GitHub Actions running lint, typecheck and tests.

Env vars (`.env.example` should point at `http://127.0.0.1:54321` locally): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only, never `NEXT_PUBLIC_`), `NEXT_PUBLIC_SITE_URL`.

## Architecture (the parts that span files)

- **The server is authoritative for everything.** The client never sends scores and never receives `answer`/`explanation` before answering.
  - `src/data/questions.json` holds the answer key and is imported only on the server (`import 'server-only'`).
  - Question payloads sent to the client contain only `{id, statement, level, category}`. A test must assert that no answer key leaks.
- **Game state lives in the Supabase `games` table** (drawn question ids, answers JSON, `current_index`, `question_shown_at`, score). This is what lets the server enforce timing and prevents forged scores. The ranking is the set of `games` rows with `saved_at is not null`.
- **Game flow via Route Handlers**, all validated with zod. Errors use the shape `{ error: { code, message } }`.
  - `POST /api/games` draws 15 questions and returns the first (its timer starts now).
  - `POST /api/games/{id}/answer` takes `{questionId, answer: boolean|null}` and returns the result, `hasNext`, and on the last question the final `summary`.
  - `POST /api/games/{id}/next` returns the current question and starts its timer. Calling it again returns the same question without restarting the timer. **This deviates from PRD sections 8.2/10**, which put the next question inside the answer response: that would start its timer while the player reads the feedback (PRD 5.2/5.4 say it must pause) or let them read the next question for free. Answering a question before `/next` showed it returns `QUESTION_NOT_SHOWN`.
  - `POST /api/games/{id}/save` takes `{nickname}`.
  - `GET /api/ranking` returns the top 20.
  - Each question can be answered only once and in order. A game can be saved only once, and only after it is finished.
  - Enforce "only once" atomically, not with read-then-write: update with a guard on the expected state (`.eq('current_index', expected)` for answers, `.is('saved_at', null)` for saves) and treat zero updated rows as a conflict error. Two concurrent requests must not both succeed.
  - `games.answers` is unvalidated JSON from the DB. Always read it through `parseStoredAnswers` (`src/types/database.ts`).
- **Stale games:** unsaved games older than 7 days can be deleted with `select public.purge_unsaved_games();`. It is not scheduled yet; on Supabase Cloud schedule it with pg_cron, and document that in the README (step 11).
- **Timer:** 15 s per question. The client bar is visual only. The server compares against `question_shown_at` and treats an answer arriving after 15 s + 2 s tolerance as a timeout (0 points). The client sends `answer: null` when the timer hits zero.
- **Supabase access is server-only** through the service role. RLS is enabled with no public policies.
- **Rate limiting** on the write endpoints is per IP, in memory (`lib/rate-limit.ts`): per instance on Vercel and no IP is stored, so no hashing salt is needed. Swap for a shared store if it must be stricter.
- **If Supabase is down, a game should still be playable.** `createResilientGameStore` creates the game in memory when the Supabase insert fails; saving copies it into Supabase and returns `STORAGE_UNAVAILABLE` (503, retryable) if that still fails. Only `StorageError` triggers the fallback, so bugs are not hidden.

## Business rules (constants live in `lib/scoring.ts`)

- A game has 15 questions drawn 5/5/5 from the beginner, intermediate and advanced pools. The order within a band is shuffled, and the bands are fixed in that order.
  - No repeats within a game.
  - Balance categories: no category more than 2× per band.
  - Aim for about 50% true / 50% false.
- Base points: 10 / 15 / 20. Speed bonus is `floor(base × 0.5 × secondsLeft / 15)`. Errors and timeouts score 0 with no penalty. Max score is 335.
- Ranking tie-break: higher score, then lower total time, then older date.
- Classification by correct answers out of 15: 0–5 Curioso, 6–9 Praticante, 10–12 Especialista, 13–14 Mestre, 15 Lenda do Claude Code.
- Nickname is optional and asked only at the end: 3–20 chars `[A-Za-z0-9_-]`, basic profanity filter. It is not unique and not authenticated. It is remembered in `localStorage`.

## Conventions

- The UI language is PT-BR. **All user-facing strings go in `lib/copy.ts`.**
- Use Server Components by default. Client components only where there is interaction (question and timer).
- Questions in `questions.json` are validated by a zod schema in tests/build:
  - Unique ids.
  - `level` is one of beginner, intermediate or advanced.
  - `category` is one of `fundamentos`, `features`, `api-sdk`, `boas-praticas`.
  - `explanation` is required.
  - Statements are self-contained.
  - Target is about 40 questions, at least 10 per level, about 50/50 true/false.
- **Verify every question against the official docs (docs.claude.com) before publishing.** Do not invent Claude Code behavior. Flag low-certainty questions for human review.
- Accessibility is a requirement (WCAG AA):
  - Full keyboard use, with `V`/`F` shortcuts for the answer buttons.
  - `aria-live` for feedback and for the 5 s timer warning.
  - Feedback must not rely on color alone.
  - Respect `prefers-reduced-motion`.
- Theme is dark with Anthropic orange (about `#D97757`), defined as Tailwind tokens. Text is `#FAF9F5` on a near-black background (`#0F0F10`/`#141413`).
