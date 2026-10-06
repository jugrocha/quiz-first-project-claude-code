import { toErrorResponse } from '@/lib/api';
import { getRanking } from '@/lib/game-service';

/** Top 20 saved games. Reads the store on every request (never prerendered). */
export async function GET() {
  try {
    return Response.json(await getRanking());
  } catch (error) {
    return toErrorResponse(error);
  }
}
