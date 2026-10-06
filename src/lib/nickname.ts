/**
 * Nickname rules (PRD 5.6): 3-20 chars of [A-Za-z0-9_-] plus a basic
 * profanity filter. The format regex must match the `games.nickname` check
 * constraint in supabase/migrations.
 */

export const NICKNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

// Blocked anywhere inside the nickname. Only words long or specific enough
// not to appear inside ordinary words.
const BLOCKED_SUBSTRINGS = [
  'caralho',
  'buceta',
  'arrombad',
  'vagabund',
  'piroca',
  'porra',
  'merda',
  'cacete',
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigger',
  'nazi',
];

// Blocked only as a whole segment (split on _ and -), because they show up
// inside harmless words ("computador", "curioso", "pausa").
const BLOCKED_WORDS = new Set([
  'puta',
  'puto',
  'cu',
  'pau',
  'pinto',
  'foda',
  'fdp',
  'pqp',
  'viado',
]);

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't' };

function normalize(segment: string): string {
  return segment.toLowerCase().replace(/[013457]/g, (d) => LEET[d]);
}

export type NicknameCheck =
  { ok: true; nickname: string } | { ok: false; reason: 'format' | 'profanity' };

export function checkNickname(input: string): NicknameCheck {
  const nickname = input.trim();
  if (!NICKNAME_PATTERN.test(nickname)) return { ok: false, reason: 'format' };

  const segments = nickname.split(/[_-]+/).filter(Boolean).map(normalize);
  const joined = segments.join('');
  if (BLOCKED_SUBSTRINGS.some((word) => joined.includes(word))) {
    return { ok: false, reason: 'profanity' };
  }
  if (segments.some((segment) => BLOCKED_WORDS.has(segment))) {
    return { ok: false, reason: 'profanity' };
  }
  return { ok: true, nickname };
}
