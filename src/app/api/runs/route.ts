import { NextResponse } from 'next/server';
import { getOrCreatePlayerId } from '@/server/identity';
import { jsonError, requireCsrf, runtimeDeps } from '@/server/http';
import { startRun } from '@/server/run-service';

export async function POST(request: Request) {
  try {
    await requireCsrf(request);
    const playerId = await getOrCreatePlayerId();
    return NextResponse.json(await startRun(runtimeDeps(playerId)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
