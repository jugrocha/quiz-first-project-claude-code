/**
 * Question ids the player has seen in this browser tab, so "play again"
 * prefers new ones (RF-11). Lives in sessionStorage: it is only a preference
 * hint, so losing it (private mode, blocked storage) just means a plain
 * random draw.
 */

const KEY = 'quiz-seen-questions';

/** About two games' worth: older ids drop off, so questions come back in rotation. */
export const SEEN_LIMIT = 30;

export function readSeenQuestions(): string[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberSeenQuestion(id: string): void {
  try {
    const seen = readSeenQuestions().filter((seenId) => seenId !== id);
    seen.push(id);
    sessionStorage.setItem(KEY, JSON.stringify(seen.slice(-SEEN_LIMIT)));
  } catch {
    // Storage unavailable: nothing to remember.
  }
}
