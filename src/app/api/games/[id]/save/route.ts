import { z } from 'zod';
import { parseBody, parseGameId, rateLimited, toErrorResponse } from '@/lib/api';
import { saveGame } from '@/lib/game-service';

// Format and profanity rules are checked in saveGame (lib/nickname.ts).
const SaveBodySchema = z.object({ nickname: z.string().max(100) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimited(request, 'save');
  if (limited) return limited;

  try {
    const gameId = parseGameId((await params).id);
    const { nickname } = await parseBody(request, SaveBodySchema);
    return Response.json(await saveGame(gameId, nickname));
  } catch (error) {
    return toErrorResponse(error);
  }
}
