import { NextResponse } from 'next/server';
import { jsonBody, jsonError, requireCsrf, runtimeDeps } from '@/server/http';
import { getOrCreatePlayerId, validPlayerId } from '@/server/identity';
import { RunServiceError, submitRound } from '@/server/run-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!validPlayerId(id)) throw new RunServiceError('RUN_NOT_FOUND', 'Run not found.', 404);
    await requireCsrf(request);
    const input = await jsonBody(request);
    const playerId = await getOrCreatePlayerId();
    return NextResponse.json(await submitRound(id, input, runtimeDeps(playerId)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
