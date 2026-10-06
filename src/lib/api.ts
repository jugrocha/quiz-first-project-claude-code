import 'server-only';

import { z } from 'zod';
import { copy, type ErrorCode } from '@/lib/copy';
import { StorageError } from '@/lib/game-store';
import { checkRateLimit, type RateLimitBucket } from '@/lib/rate-limit';

/** Shared plumbing for the Route Handlers in src/app/api. */

const STATUS: Record<ErrorCode, number> = {
  INVALID_BODY: 400,
  INVALID_GAME_ID: 400,
  GAME_NOT_FOUND: 404,
  QUESTION_NOT_IN_GAME: 400,
  QUESTION_NOT_SHOWN: 409,
  ALREADY_ANSWERED: 409,
  OUT_OF_ORDER: 409,
  GAME_FINISHED: 409,
  GAME_NOT_FINISHED: 409,
  ALREADY_SAVED: 409,
  CONFLICT: 409,
  INVALID_NICKNAME: 400,
  NICKNAME_NOT_ALLOWED: 400,
  RATE_LIMITED: 429,
  STORAGE_UNAVAILABLE: 503,
  INTERNAL: 500,
};

/** A business-rule failure that maps to `{ error: { code, message } }`. */
export class ApiError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(copy.errors[code]);
    this.name = 'ApiError';
  }
}

export function errorResponse(code: ErrorCode, headers?: HeadersInit): Response {
  return Response.json(
    { error: { code, message: copy.errors[code] } },
    { status: STATUS[code], headers },
  );
}

/** Converts anything a handler throws into the API error shape. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) return errorResponse(error.code);
  if (error instanceof StorageError) {
    console.error(error.message);
    return errorResponse('STORAGE_UNAVAILABLE');
  }
  console.error('Unhandled API error', error);
  return errorResponse('INTERNAL');
}

export function rateLimited(request: Request, bucket: RateLimitBucket): Response | null {
  const result = checkRateLimit(request, bucket);
  if (result.ok) return null;
  return errorResponse('RATE_LIMITED', { 'Retry-After': String(result.retryAfterSeconds) });
}

const GameIdSchema = z.uuid();

export function parseGameId(id: string): string {
  const result = GameIdSchema.safeParse(id);
  if (!result.success) throw new ApiError('INVALID_GAME_ID');
  return result.data;
}

export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ApiError('INVALID_BODY');
  }
  const result = schema.safeParse(json);
  if (!result.success) throw new ApiError('INVALID_BODY');
  return result.data;
}
