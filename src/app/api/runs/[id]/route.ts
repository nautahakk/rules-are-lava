import { NextResponse } from 'next/server';
import { jsonError, runtimeDeps } from '@/server/http';
import { getOrCreatePlayerId, validPlayerId } from '@/server/identity';
import { restoreRun, RunServiceError } from '@/server/run-service';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!validPlayerId(id)) throw new RunServiceError('RUN_NOT_FOUND', 'Run not found.', 404);
    const playerId = await getOrCreatePlayerId();
    return NextResponse.json(await restoreRun(id, runtimeDeps(playerId)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
