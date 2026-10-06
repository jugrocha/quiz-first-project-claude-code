import { z } from 'zod';
import { parseBody, parseGameId, rateLimited, toErrorResponse } from '@/lib/api';
import { submitAnswer } from '@/lib/game-service';

const AnswerBodySchema = z.object({
  questionId: z.string().min(1).max(100),
  // null = the client's timer hit zero.
  answer: z.boolean().nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimited(request, 'gameAction');
  if (limited) return limited;

  try {
    const gameId = parseGameId((await params).id);
    const body = await parseBody(request, AnswerBodySchema);
    return Response.json(await submitAnswer(gameId, body));
  } catch (error) {
    return toErrorResponse(error);
  }
}
