import { copy, type ErrorCode } from '@/lib/copy';
import type { AnswerResult, QuestionPayload } from '@/types/api';

/** Browser-side calls to the /api routes. */

export class ApiRequestError extends Error {
  constructor(
    /** 'NETWORK' when the server could not be reached at all. */
    public readonly code: ErrorCode | 'NETWORK',
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError('NETWORK', copy.play.networkError);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data?.error;
    const code: ErrorCode = error?.code in copy.errors ? error.code : 'INTERNAL';
    throw new ApiRequestError(code, copy.errors[code]);
  }
  return data as T;
}

export const apiClient = {
  createGame: (seen: string[] = []) => post<QuestionPayload>('/api/games', { seen }),
  next: (gameId: string) => post<QuestionPayload>(`/api/games/${gameId}/next`),
  answer: (gameId: string, questionId: string, answer: boolean | null) =>
    post<AnswerResult>(`/api/games/${gameId}/answer`, { questionId, answer }),
  save: (gameId: string, nickname: string) =>
    post<{ rank: number }>(`/api/games/${gameId}/save`, { nickname }),
};
