import { parseGameId, rateLimited, toErrorResponse } from '@/lib/api';
import { showNextQuestion } from '@/lib/game-service';

/** Returns the current question and starts its 15 s timer (idempotent). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimited(request, 'gameAction');
  if (limited) return limited;

  try {
    const gameId = parseGameId((await params).id);
    return Response.json(await showNextQuestion(gameId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
