import { POST as createGameRoute } from '@/app/api/games/route';
import { POST as answerRoute } from '@/app/api/games/[id]/answer/route';
import { POST as nextRoute } from '@/app/api/games/[id]/next/route';
import { POST as saveRoute } from '@/app/api/games/[id]/save/route';
import { GET as rankingRoute } from '@/app/api/ranking/route';
import { vi } from 'vitest';
import { loadQuestions } from '@/lib/questions';

/** Calls the Route Handlers directly, the way Next.js would. */

const answerKey = new Map(loadQuestions().map((q) => [q.id, q.answer]));

export function correctAnswerFor(questionId: string): boolean {
  const answer = answerKey.get(questionId);
  if (answer === undefined) throw new Error(`Unknown question ${questionId}`);
  return answer;
}

function post(path: string, body?: unknown, ip = '203.0.113.1'): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

export type QuestionPayload = {
  gameId: string;
  index: number;
  total: number;
  question: { id: string; statement: string; level: string; category: string };
  timeLimitMs: number;
};

export async function json<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export const api = {
  createGame: (ip?: string) => createGameRoute(post('/api/games', undefined, ip)),
  next: (id: string) => nextRoute(post(`/api/games/${id}/next`), ctx(id)),
  answer: (id: string, body: unknown) =>
    answerRoute(post(`/api/games/${id}/answer`, body), ctx(id)),
  save: (id: string, body: unknown) => saveRoute(post(`/api/games/${id}/save`, body), ctx(id)),
  ranking: () => rankingRoute(),
};

export async function startGame(): Promise<QuestionPayload> {
  const response = await api.createGame();
  if (response.status !== 201) throw new Error(`createGame returned ${response.status}`);
  return json<QuestionPayload>(response);
}

/**
 * Plays a whole game. `pick(index)` decides each answer: 'right', 'wrong' or
 * 'timeout' (answer: null). Returns the last answer response body.
 */
export async function playGame(
  pick: (index: number) => 'right' | 'wrong' | 'timeout' = () => 'right',
  options: { readingMs?: number } = {},
): Promise<{ gameId: string; last: Record<string, unknown> }> {
  let current = await startGame();
  const gameId = current.gameId;
  let last: Record<string, unknown> = {};

  for (let i = 0; i < current.total; i++) {
    if (i > 0) {
      // Time spent on the feedback screen: counts toward the total game time
      // but not toward any question's timer. Needs fake Date timers.
      if (options.readingMs) vi.setSystemTime(Date.now() + options.readingMs);
      current = await json<QuestionPayload>(await api.next(gameId));
    }
    const choice = pick(i);
    const right = correctAnswerFor(current.question.id);
    const answer = choice === 'timeout' ? null : choice === 'right' ? right : !right;
    const response = await api.answer(gameId, { questionId: current.question.id, answer });
    if (response.status !== 200) throw new Error(`answer ${i} returned ${response.status}`);
    last = await json(response);
  }
  return { gameId, last };
}
