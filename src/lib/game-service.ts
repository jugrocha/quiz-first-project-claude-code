import 'server-only';

import { ApiError } from '@/lib/api';
import { evaluateAnswer } from '@/lib/game';
import { getGameStore, type GameRecord } from '@/lib/game-store';
import { checkNickname } from '@/lib/nickname';
import { drawGameQuestions, loadQuestions, toPublicQuestion } from '@/lib/questions';
import { QUESTION_TIME_LIMIT_SECONDS, TOTAL_QUESTIONS, classify } from '@/lib/scoring';
import type {
  AnswerResult,
  GameResult,
  GameSummary,
  QuestionPayload,
  RankingEntryPayload,
} from '@/types/api';
import type { StoredAnswer } from '@/types/database';
import type { Question } from '@/types/question';

/**
 * Game flow on top of the store. The server owns every rule: drawing,
 * timing (question_shown_at vs. server clock), scoring and the
 * once-only/in-order guarantees. Route handlers only parse input and map
 * ApiError to HTTP.
 *
 * A question's timer starts when the client asks for it (startGame for the
 * first, showNextQuestion for the rest), not when the previous answer
 * returns, so the timer stays paused while the player reads the feedback
 * (PRD 5.2 and 5.4).
 */

export const TIME_LIMIT_MS = QUESTION_TIME_LIMIT_SECONDS * 1000;
export const RANKING_SIZE = 20;

let questionsById: Map<string, Question> | null = null;

function questionBank(): Map<string, Question> {
  questionsById ??= new Map(loadQuestions().map((q) => [q.id, q]));
  return questionsById;
}

function questionAt(game: GameRecord, index: number): Question {
  const question = questionBank().get(game.questionIds[index]);
  // Only possible if a question was removed from the bank mid-game.
  if (!question) throw new Error(`Question ${game.questionIds[index]} is not in the bank`);
  return question;
}

const nowIso = () => new Date().toISOString();

async function loadGame(id: string): Promise<GameRecord> {
  const game = await getGameStore().get(id);
  if (!game) throw new ApiError('GAME_NOT_FOUND');
  return game;
}

function questionPayload(game: GameRecord, shownAt: string): QuestionPayload {
  const elapsed = Date.now() - Date.parse(shownAt);
  return {
    gameId: game.id,
    index: game.currentIndex,
    total: TOTAL_QUESTIONS,
    question: toPublicQuestion(questionAt(game, game.currentIndex)),
    timeLimitMs: TIME_LIMIT_MS,
    remainingMs: Math.max(0, Math.min(TIME_LIMIT_MS, TIME_LIMIT_MS - elapsed)),
    score: game.score,
  };
}

/** `seen`: question ids the player saw earlier this session, drawn last (RF-11). */
export async function startGame(seen: readonly string[] = []): Promise<QuestionPayload> {
  const questions = drawGameQuestions([...questionBank().values()], { seen: new Set(seen) });
  const now = nowIso();
  const game = await getGameStore().create({
    questionIds: questions.map((q) => q.id),
    startedAt: now,
    questionShownAt: now,
  });
  return questionPayload(game, now);
}

/**
 * Shows the current question and starts its timer. Calling it again for an
 * already-shown question returns the same question without restarting the
 * timer, so a retried request can't buy extra time.
 */
export async function showNextQuestion(gameId: string): Promise<QuestionPayload> {
  const game = await loadGame(gameId);
  if (game.currentIndex >= TOTAL_QUESTIONS) throw new ApiError('GAME_FINISHED');
  if (game.questionShownAt !== null) return questionPayload(game, game.questionShownAt);

  const shownAt = nowIso();
  if (await getGameStore().markShown(game.id, game.currentIndex, shownAt)) {
    return questionPayload(game, shownAt);
  }
  // Lost a race: another request started the timer first, so use its time.
  const current = await loadGame(gameId);
  if (current.currentIndex !== game.currentIndex || current.questionShownAt === null) {
    throw new ApiError('CONFLICT');
  }
  return questionPayload(current, current.questionShownAt);
}

function buildSummary(game: GameRecord & { finishedAt: string }): GameSummary {
  const review = game.answers
    .filter((answer) => !answer.correct)
    .flatMap((answer) => {
      // A question removed from the bank after the game was played is left
      // out of the review; the stored score and counts are unaffected.
      const question = questionBank().get(answer.questionId);
      if (!question) return [];
      return {
        questionId: question.id,
        statement: question.statement,
        yourAnswer: answer.answer,
        correctAnswer: question.answer,
        explanation: question.explanation,
        ...(question.docUrl ? { docUrl: question.docUrl } : {}),
        timedOut: answer.timedOut,
      };
    });
  return {
    score: game.score,
    correctCount: game.correctCount,
    total: TOTAL_QUESTIONS,
    durationMs: Date.parse(game.finishedAt) - Date.parse(game.startedAt),
    classification: classify(game.correctCount),
    review,
  };
}

export async function submitAnswer(
  gameId: string,
  input: { questionId: string; answer: boolean | null },
): Promise<AnswerResult> {
  const answeredAt = nowIso();
  const game = await loadGame(gameId);

  const position = game.questionIds.indexOf(input.questionId);
  if (position === -1) throw new ApiError('QUESTION_NOT_IN_GAME');
  if (game.currentIndex >= TOTAL_QUESTIONS) throw new ApiError('GAME_FINISHED');
  if (position < game.currentIndex) throw new ApiError('ALREADY_ANSWERED');
  if (position > game.currentIndex) throw new ApiError('OUT_OF_ORDER');
  if (game.questionShownAt === null) throw new ApiError('QUESTION_NOT_SHOWN');

  const question = questionAt(game, position);
  const result = evaluateAnswer({
    level: question.level,
    correctAnswer: question.answer,
    submittedAnswer: input.answer,
    questionShownAt: new Date(game.questionShownAt),
    answeredAt: new Date(answeredAt),
  });

  const answers: StoredAnswer[] = [
    ...game.answers,
    {
      questionId: question.id,
      answer: input.answer,
      correct: result.correct,
      points: result.pointsAwarded,
      shownAt: game.questionShownAt,
      answeredAt,
      timedOut: result.timedOut,
    },
  ];
  const nextIndex = position + 1;
  const finished = nextIndex === TOTAL_QUESTIONS;
  const score = game.score + result.pointsAwarded;
  const correctCount = game.correctCount + (result.correct ? 1 : 0);
  const finishedAt = finished ? answeredAt : null;

  const applied = await getGameStore().recordAnswer(game.id, position, {
    answers,
    currentIndex: nextIndex,
    score,
    correctCount,
    finishedAt,
  });
  // A concurrent request answered this question first.
  if (!applied) throw new ApiError('ALREADY_ANSWERED');

  return {
    correct: result.correct,
    timedOut: result.timedOut,
    correctAnswer: question.answer,
    explanation: question.explanation,
    ...(question.docUrl ? { docUrl: question.docUrl } : {}),
    points: result.pointsAwarded,
    runningScore: score,
    hasNext: !finished,
    ...(finishedAt
      ? { summary: buildSummary({ ...game, answers, score, correctCount, finishedAt }) }
      : {}),
  };
}

export async function saveGame(gameId: string, rawNickname: string): Promise<{ rank: number }> {
  const check = checkNickname(rawNickname);
  if (!check.ok) {
    throw new ApiError(check.reason === 'format' ? 'INVALID_NICKNAME' : 'NICKNAME_NOT_ALLOWED');
  }

  const game = await loadGame(gameId);
  if (game.finishedAt === null) throw new ApiError('GAME_NOT_FINISHED');
  if (game.savedAt !== null) throw new ApiError('ALREADY_SAVED');

  const store = getGameStore();
  // A concurrent request saved it first.
  if (!(await store.save(game.id, check.nickname, nowIso()))) throw new ApiError('ALREADY_SAVED');

  return { rank: await store.rankOf(await loadGame(game.id)) };
}

/** For the result page: the summary of a finished game, and its rank if saved. */
export async function getGameResult(gameId: string): Promise<GameResult> {
  const store = getGameStore();
  const game = await store.get(gameId);
  if (!game) return { status: 'not_found' };
  if (game.finishedAt === null) return { status: 'in_progress' };

  const saved =
    game.savedAt !== null && game.nickname !== null
      ? { nickname: game.nickname, rank: await store.rankOf(game) }
      : null;
  return {
    status: 'finished',
    summary: buildSummary({ ...game, finishedAt: game.finishedAt }),
    saved,
  };
}

/**
 * Top 20 saved games. `highlightGameId` marks the player's own row (for the
 * ranking page after saving); game ids themselves are never returned.
 */
export async function getRanking(
  options: { highlightGameId?: string } = {},
): Promise<{ entries: RankingEntryPayload[] }> {
  const rows = await getGameStore().topRanking(RANKING_SIZE);
  return {
    entries: rows.map(({ id, ...row }, i) => ({
      rank: i + 1,
      ...row,
      ...(options.highlightGameId === id ? { isYou: true } : {}),
    })),
  };
}
