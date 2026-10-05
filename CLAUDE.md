# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

The project is scaffolded (Next.js App Router + TypeScript strict + Tailwind v4, ESLint, Prettier, Vitest). PRD section 13 steps 1–3 are done: tooling, the `Question` zod schema (`src/types/question.ts`), a placeholder 18-question seed bank (`src/data/questions.json` — content not yet fact-checked against docs.claude.com, see section 11.4), and the pure business-rule libraries `src/lib/scoring.ts`, `src/lib/questions.ts`, `src/lib/game.ts` with unit tests in `tests/`. There is no Supabase integration, no API routes, and no quiz UI yet — `src/app/page.tsx` is still the default Next.js starter page. Read `prd.md` in full before continuing. Section 13 defines the remaining implementation order (steps 4–11), and section 17 is the Definition of Done.

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
  - `POST /api/games` draws 15 questions and returns the first.
  - `POST /api/games/{id}/answer` takes `{questionId, answer: boolean|null}` and returns the result plus the next question or the final summary.
  - `POST /api/games/{id}/save` takes `{nickname}`.
  - `GET /api/ranking` returns the top 20.
  - Each question can be answered only once and in order. A game can be saved only once, and only after it is finished.
- **Timer:** 15 s per question. The client bar is visual only. The server compares against `question_shown_at` and treats an answer arriving after 15 s + 2 s tolerance as a timeout (0 points). The client sends `answer: null` when the timer hits zero.
- **Supabase access is server-only** through the service role. RLS is enabled with no public policies.
- **Rate limiting** is required on the write endpoints (per IP).
- **If Supabase is down, a game should still be playable.** Saving to the ranking shows an error with retry.

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
