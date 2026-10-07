import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGameResult, getRanking } from '@/lib/game-service';
import { createMemoryGameStore, setGameStoreForTesting, type GameStore } from '@/lib/game-store';
import { loadQuestions } from '@/lib/questions';
import { resetRateLimits, RATE_LIMITS } from '@/lib/rate-limit';
import { MAX_SCORE, TOTAL_QUESTIONS } from '@/lib/scoring';
import { api, correctAnswerFor, json, playGame, startGame, type QuestionPayload } from './helpers';

type ErrorBody = { error: { code: string; message: string } };

const START = new Date('2026-10-06T12:00:00.000Z');
const levelOf = new Map(loadQuestions().map((q) => [q.id, q.level]));

let store: GameStore;

/** The game's drawn question ids, read server-side (a client can't see them). */
async function questionIdsOf(gameId: string): Promise<string[]> {
  return (await store.get(gameId))!.questionIds;
}

function advance(ms: number) {
  vi.setSystemTime(new Date(Date.now() + ms));
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  const body = await json<ErrorBody>(response);
  expect(body.error.code).toBe(code);
  expect(body.error.message).toEqual(expect.any(String));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  store = createMemoryGameStore();
  setGameStoreForTesting(store);
  resetRateLimits();
});

afterEach(() => {
  vi.useRealTimers();
  setGameStoreForTesting(null);
});

describe('no answer key leaks', () => {
  const PUBLIC_KEYS = ['category', 'id', 'level', 'statement'];

  it('POST /api/games returns only public question fields', async () => {
    const response = await api.createGame();
    expect(response.status).toBe(201);
    const body = await json<QuestionPayload>(response);

    expect(body).toMatchObject({ index: 0, total: 15, timeLimitMs: 15_000 });
    expect(Object.keys(body.question).sort()).toEqual(PUBLIC_KEYS);
    expect(JSON.stringify(body)).not.toMatch(/answer|explanation|docUrl/);
  });

  it('POST /next returns only public question fields', async () => {
    const game = await startGame();
    await api.answer(game.gameId, { questionId: game.question.id, answer: true });

    const body = await json<QuestionPayload>(await api.next(game.gameId));
    expect(body.index).toBe(1);
    expect(Object.keys(body.question).sort()).toEqual(PUBLIC_KEYS);
    expect(JSON.stringify(body)).not.toMatch(/answer|explanation|docUrl/);
  });

  it('the answer response does not include the next question', async () => {
    const game = await startGame();
    const response = await api.answer(game.gameId, { questionId: game.question.id, answer: true });
    const body = await json(response);
    expect(body.hasNext).toBe(true);
    expect(body).not.toHaveProperty('next');
    expect(body).not.toHaveProperty('question');
  });
});

describe('full game', () => {
  it('answering all 15 instantly and correctly scores the maximum', async () => {
    const { last } = await playGame(() => 'right');
    expect(last.hasNext).toBe(false);
    expect(last.runningScore).toBe(MAX_SCORE);
    expect(last.summary).toMatchObject({
      score: MAX_SCORE,
      correctCount: 15,
      total: TOTAL_QUESTIONS,
      classification: 'Lenda do Claude Code',
      review: [],
    });
  });

  it('draws the bands in order (5 beginner, 5 intermediate, 5 advanced) with no repeats', async () => {
    const game = await startGame();
    const ids = await questionIdsOf(game.gameId);
    expect(new Set(ids).size).toBe(15);
    expect(ids.map((id) => levelOf.get(id))).toEqual([
      ...Array(5).fill('beginner'),
      ...Array(5).fill('intermediate'),
      ...Array(5).fill('advanced'),
    ]);
  });

  it('wrong answers return the correct answer and explanation, and appear in the review', async () => {
    const { last } = await playGame((i) => (i < 3 ? 'wrong' : 'right'));
    const summary = last.summary as { correctCount: number; review: Record<string, unknown>[] };
    expect(summary.correctCount).toBe(12);
    expect(summary.review).toHaveLength(3);
    for (const item of summary.review) {
      expect(item.correctAnswer).toBe(!item.yourAnswer);
      expect(item.explanation).toEqual(expect.any(String));
    }
  });

  it('reports a wrong answer with 0 points and the answer key', async () => {
    const game = await startGame();
    const right = correctAnswerFor(game.question.id);
    const body = await json(
      await api.answer(game.gameId, { questionId: game.question.id, answer: !right }),
    );
    expect(body).toMatchObject({
      correct: false,
      timedOut: false,
      points: 0,
      correctAnswer: right,
    });
    expect(body.explanation).toEqual(expect.any(String));
  });
});

describe('resuming a game (page reload)', () => {
  it('/next reports the time left and the score so far without restarting the timer', async () => {
    const game = await startGame();
    expect(game).toMatchObject({ remainingMs: 15_000, score: 0 });
    await api.answer(game.gameId, {
      questionId: game.question.id,
      answer: correctAnswerFor(game.question.id),
    });
    await api.next(game.gameId);
    advance(4_000);

    const resumed = await json<QuestionPayload & { remainingMs: number; score: number }>(
      await api.next(game.gameId),
    );
    expect(resumed).toMatchObject({ index: 1, remainingMs: 11_000, score: 15 });
  });

  it('never reports negative time left', async () => {
    const game = await startGame();
    advance(60_000);
    expect(await json(await api.next(game.gameId))).toMatchObject({ remainingMs: 0 });
  });
});

describe('getGameResult (result page)', () => {
  it('reports unknown and unfinished games', async () => {
    expect(await getGameResult(crypto.randomUUID())).toEqual({ status: 'not_found' });
    const game = await startGame();
    expect(await getGameResult(game.gameId)).toEqual({ status: 'in_progress' });
  });

  it('returns the summary, and the nickname and rank once saved', async () => {
    const { gameId, last } = await playGame((i) => (i === 0 ? 'wrong' : 'right'));
    const before = await getGameResult(gameId);
    expect(before).toMatchObject({ status: 'finished', summary: last.summary, saved: null });

    await api.save(gameId, { nickname: 'jogador' });
    expect(await getGameResult(gameId)).toMatchObject({
      status: 'finished',
      saved: { nickname: 'jogador', rank: 1 },
    });
  });
});

describe('server-side timer', () => {
  it('accepts an answer at exactly 15 s + 2 s tolerance, with no speed bonus', async () => {
    const game = await startGame();
    advance(17_000);
    const body = await json(
      await api.answer(game.gameId, {
        questionId: game.question.id,
        answer: correctAnswerFor(game.question.id),
      }),
    );
    expect(body).toMatchObject({ correct: true, timedOut: false, points: 10 });
  });

  it('treats an answer arriving after 17 s as a timeout worth 0 points', async () => {
    const game = await startGame();
    advance(17_001);
    const body = await json(
      await api.answer(game.gameId, {
        questionId: game.question.id,
        answer: correctAnswerFor(game.question.id),
      }),
    );
    expect(body).toMatchObject({ correct: false, timedOut: true, points: 0 });
    expect(body.correctAnswer).toBe(correctAnswerFor(game.question.id));
  });

  it('treats answer: null as a timeout', async () => {
    const game = await startGame();
    const body = await json(
      await api.answer(game.gameId, { questionId: game.question.id, answer: null }),
    );
    expect(body).toMatchObject({ correct: false, timedOut: true, points: 0 });
  });

  it('does not run the next timer while the player reads the feedback', async () => {
    const game = await startGame();
    await api.answer(game.gameId, { questionId: game.question.id, answer: true });
    advance(60_000); // reading the explanation
    const next = await json<QuestionPayload>(await api.next(game.gameId));
    advance(1_000);
    const body = await json(
      await api.answer(game.gameId, {
        questionId: next.question.id,
        answer: correctAnswerFor(next.question.id),
      }),
    );
    expect(body).toMatchObject({ correct: true, timedOut: false });
  });

  it('calling /next again does not restart the timer', async () => {
    const game = await startGame();
    await api.answer(game.gameId, { questionId: game.question.id, answer: true });
    const next = await json<QuestionPayload>(await api.next(game.gameId));
    advance(10_000);
    const again = await json<QuestionPayload>(await api.next(game.gameId));
    expect(again.question.id).toBe(next.question.id);
    advance(8_000); // 18 s since it was first shown
    const body = await json(
      await api.answer(game.gameId, {
        questionId: next.question.id,
        answer: correctAnswerFor(next.question.id),
      }),
    );
    expect(body.timedOut).toBe(true);
  });
});

describe('answer rules', () => {
  it('rejects answering the same question twice', async () => {
    const game = await startGame();
    const body = { questionId: game.question.id, answer: true };
    expect((await api.answer(game.gameId, body)).status).toBe(200);
    await expectError(await api.answer(game.gameId, body), 409, 'ALREADY_ANSWERED');
  });

  it('lets only one of two concurrent answers to the same question succeed', async () => {
    const game = await startGame();
    const body = { questionId: game.question.id, answer: true };
    const statuses = (
      await Promise.all([api.answer(game.gameId, body), api.answer(game.gameId, body)])
    ).map((r) => r.status);
    expect(statuses.sort()).toEqual([200, 409]);
  });

  it('rejects answering a later question out of order', async () => {
    const game = await startGame();
    const ids = await questionIdsOf(game.gameId);
    const response = await api.answer(game.gameId, { questionId: ids[3], answer: true });
    await expectError(response, 409, 'OUT_OF_ORDER');
  });

  it('rejects a question that is not part of the game', async () => {
    const game = await startGame();
    const response = await api.answer(game.gameId, { questionId: 'not-a-real-id', answer: true });
    await expectError(response, 400, 'QUESTION_NOT_IN_GAME');
  });

  it('rejects answering before /next shows the question', async () => {
    const game = await startGame();
    const ids = await questionIdsOf(game.gameId);
    await api.answer(game.gameId, { questionId: ids[0], answer: true });
    const response = await api.answer(game.gameId, { questionId: ids[1], answer: true });
    await expectError(response, 409, 'QUESTION_NOT_SHOWN');
  });

  it('rejects /next and answers after the game is finished', async () => {
    const { gameId } = await playGame();
    const ids = await questionIdsOf(gameId);
    await expectError(await api.next(gameId), 409, 'GAME_FINISHED');
    await expectError(
      await api.answer(gameId, { questionId: ids[14], answer: true }),
      409,
      'GAME_FINISHED',
    );
  });
});

describe('input validation', () => {
  it('returns 404 for an unknown game', async () => {
    await expectError(await api.next(crypto.randomUUID()), 404, 'GAME_NOT_FOUND');
  });

  it('returns 400 for a malformed game id', async () => {
    await expectError(await api.next('abc'), 400, 'INVALID_GAME_ID');
  });

  it.each([
    ['not JSON', '{oops'],
    ['missing answer', { questionId: 'x' }],
    ['answer is a string', { questionId: 'x', answer: 'true' }],
    ['missing questionId', { answer: true }],
  ])('returns 400 for an invalid answer body (%s)', async (_label, body) => {
    const game = await startGame();
    await expectError(await api.answer(game.gameId, body), 400, 'INVALID_BODY');
  });
});

describe('saving to the ranking', () => {
  it('rejects saving an unfinished game', async () => {
    const game = await startGame();
    await expectError(
      await api.save(game.gameId, { nickname: 'jogador' }),
      409,
      'GAME_NOT_FINISHED',
    );
  });

  it('saves a finished game once and returns its rank', async () => {
    const { gameId } = await playGame();
    const response = await api.save(gameId, { nickname: 'jogador_1' });
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ rank: 1 });

    await expectError(await api.save(gameId, { nickname: 'outro' }), 409, 'ALREADY_SAVED');
  });

  it('lets only one of two concurrent saves succeed', async () => {
    const { gameId } = await playGame();
    const statuses = (
      await Promise.all([
        api.save(gameId, { nickname: 'primeiro' }),
        api.save(gameId, { nickname: 'segundo' }),
      ])
    ).map((r) => r.status);
    expect(statuses.sort()).toEqual([200, 409]);
  });

  it.each([
    ['too short', 'ab', 'INVALID_NICKNAME'],
    ['invalid characters', 'joão!', 'INVALID_NICKNAME'],
    ['profanity', 'caralho123', 'NICKNAME_NOT_ALLOWED'],
  ])('rejects a nickname that is %s', async (_label, nickname, code) => {
    const { gameId } = await playGame();
    await expectError(await api.save(gameId, { nickname }), 400, code);
  });
});

describe('GET /api/ranking', () => {
  it('is empty before anyone saves', async () => {
    expect(await json(await api.ranking())).toEqual({ entries: [] });
  });

  it('orders by score, then by total time, and leaves unsaved games out', async () => {
    // Same perfect score; "lento" spends longer on the feedback screens.
    const slow = await playGame(() => 'right', { readingMs: 2_000 });
    const fast = await playGame(() => 'right', { readingMs: 1_000 });
    const weak = await playGame((i) => (i < 5 ? 'wrong' : 'right'));
    await playGame(); // finished but never saved

    expect(await json(await api.save(weak.gameId, { nickname: 'fraco' }))).toEqual({ rank: 1 });
    expect(await json(await api.save(slow.gameId, { nickname: 'lento' }))).toEqual({ rank: 1 });
    expect(await json(await api.save(fast.gameId, { nickname: 'rapido' }))).toEqual({ rank: 1 });

    const { entries } = await json<{ entries: Record<string, unknown>[] }>(await api.ranking());
    expect(entries.map((e) => e.nickname)).toEqual(['rapido', 'lento', 'fraco']);
    expect(entries.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(entries[0]).toMatchObject({ score: MAX_SCORE, correctCount: 15, durationMs: 14_000 });
    expect(entries[1]).toMatchObject({ score: MAX_SCORE, durationMs: 28_000 });
  });

  it('breaks a full tie by the older game', async () => {
    const first = await playGame();
    const second = await playGame();
    await api.save(second.gameId, { nickname: 'segundo' });
    expect(await json(await api.save(first.gameId, { nickname: 'primeiro' }))).toEqual({ rank: 1 });
  });
});

describe('ranking highlight', () => {
  it('the public API never exposes game ids', async () => {
    const { gameId } = await playGame();
    await api.save(gameId, { nickname: 'jogador' });
    const body = JSON.stringify(await json(await api.ranking()));
    expect(body).not.toContain(gameId);
    expect(body).not.toMatch(/"id"|isYou/);
  });

  it("marks only the player's own row when asked to", async () => {
    const mine = await playGame();
    const other = await playGame((i) => (i === 0 ? 'wrong' : 'right'));
    await api.save(mine.gameId, { nickname: 'euzinha' });
    await api.save(other.gameId, { nickname: 'outro' });

    const { entries } = await getRanking({ highlightGameId: other.gameId });
    expect(entries.map((e) => [e.nickname, e.isYou ?? false])).toEqual([
      ['euzinha', false],
      ['outro', true],
    ]);
    expect(JSON.stringify(entries)).not.toContain(other.gameId);
  });
});

describe('rate limiting', () => {
  it('returns 429 with Retry-After once an IP creates too many games', async () => {
    for (let i = 0; i < RATE_LIMITS.createGame; i++) {
      expect((await api.createGame()).status).toBe(201);
    }
    const limited = await api.createGame();
    await expectError(limited, 429, 'RATE_LIMITED');
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);

    // Other IPs are unaffected, and the window resets after a minute.
    expect((await api.createGame('198.51.100.7')).status).toBe(201);
    advance(60_000);
    expect((await api.createGame()).status).toBe(201);
  });
});
