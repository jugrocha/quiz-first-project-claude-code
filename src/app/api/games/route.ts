import { z } from 'zod';
import { parseBody, rateLimited, toErrorResponse } from '@/lib/api';
import { startGame } from '@/lib/game-service';

/** `seen`: ids shown earlier this browser session, so a new game prefers others (RF-11). */
const CreateGameBody = z.object({
  seen: z.array(z.string().min(1).max(100)).max(100).default([]),
});

/** Draws 15 questions, creates the game and returns (and starts) question 1. */
export async function POST(request: Request) {
  const limited = rateLimited(request, 'createGame');
  if (limited) return limited;

  try {
    const { seen } = await parseBody(request, CreateGameBody, { optional: true });
    return Response.json(await startGame(seen), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
