/**
 * Basic per-IP fixed-window rate limiting for the write endpoints.
 *
 * Counters live in memory, so on Vercel each instance counts separately and a
 * cold start resets them. That is enough to blunt scripted abuse for a
 * portfolio project, and no IP is ever stored. If it needs to be stricter,
 * swap this for a shared store (Upstash/Vercel KV or a Supabase table, the
 * latter with hashed IPs).
 */

export type RateLimitBucket = 'createGame' | 'gameAction' | 'save';

const WINDOW_MS = 60_000;

/** Requests allowed per IP per minute. A full game is 1 create + 29 actions. */
export const RATE_LIMITS: Record<RateLimitBucket, number> = {
  createGame: 10,
  gameAction: 120,
  save: 10,
};

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < WINDOW_MS) return;
  lastSweep = now;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function checkRateLimit(request: Request, bucket: RateLimitBucket): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const key = `${bucket}:${clientIp(request)}`;
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (current.count >= RATE_LIMITS[bucket]) {
    return { ok: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count++;
  return { ok: true };
}

export function resetRateLimits(): void {
  windows.clear();
  lastSweep = 0;
}
