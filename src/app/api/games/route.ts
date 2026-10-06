import { rateLimited, toErrorResponse } from '@/lib/api';
import { startGame } from '@/lib/game-service';

/** Draws 15 questions, creates the game and returns (and starts) question 1. */
export async function POST(request: Request) {
  const limited = rateLimited(request, 'createGame');
  if (limited) return limited;

  try {
    return Response.json(await startGame(), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
