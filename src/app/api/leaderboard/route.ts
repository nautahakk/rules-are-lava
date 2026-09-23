import { NextResponse } from 'next/server';
import { challengeDate, nextResetAt } from '@/game/daily';
import { getOrCreateCsrfToken, jsonError, runtimeDeps } from '@/server/http';
import { getOrCreatePlayerId } from '@/server/identity';

export async function GET() {
  try {
    const now = new Date();
    const playerId = await getOrCreatePlayerId();
    const csrfToken = await getOrCreateCsrfToken();
    const board = await runtimeDeps(playerId).repo.leaderboard(challengeDate(now), playerId);
    return NextResponse.json({
      topScore: board.top[0]?.score ?? 0,
      ...board,
      resetAt: nextResetAt(now).toISOString(),
      csrfToken
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
