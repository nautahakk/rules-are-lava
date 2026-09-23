import { randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceDatabase } from './db';
import { validPlayerId } from './identity';
import { evaluateSemanticRules } from './jev';
import { SupabaseRunRepository } from './run-repository';
import { RunServiceError, type RunServiceDeps } from './run-service';

type CookieStore = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: Record<string, unknown>): unknown;
};

export function validCsrfRequest(
  requestUrl: string,
  origin: string | null,
  headerToken: string | null,
  cookieToken: string | undefined
): boolean {
  if (!origin || !headerToken || !validPlayerId(headerToken) || !validPlayerId(cookieToken)) return false;
  try {
    if (new URL(origin).origin !== new URL(requestUrl).origin) return false;
  } catch {
    return false;
  }
  const header = Buffer.from(headerToken);
  const cookie = Buffer.from(cookieToken);
  return header.length === cookie.length && timingSafeEqual(header, cookie);
}

export async function getOrCreateCsrfToken(store?: CookieStore): Promise<string> {
  const cookieStore = store ?? await cookies();
  const existing = cookieStore.get('ral_csrf')?.value;
  if (validPlayerId(existing)) return existing;
  const token = randomUUID();
  cookieStore.set('ral_csrf', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24
  });
  return token;
}

export async function requireCsrf(request: Request, store?: CookieStore): Promise<void> {
  const cookieStore = store ?? await cookies();
  if (!validCsrfRequest(
    request.url,
    request.headers.get('origin'),
    request.headers.get('x-csrf-token'),
    cookieStore.get('ral_csrf')?.value
  )) {
    throw new RunServiceError('CSRF_FAILED', 'Refresh the page and try again.', 403);
  }
}

export async function jsonBody(request: Request): Promise<unknown> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if ((length && (!Number.isFinite(length) || length > 2048)) ||
    !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new RunServiceError('INVALID_REQUEST', 'Invalid request body.', 400);
  }
  try {
    return await request.json();
  } catch {
    throw new RunServiceError('INVALID_REQUEST', 'Invalid request body.', 400);
  }
}

export function runtimeDeps(playerId: string): RunServiceDeps {
  return {
    repo: new SupabaseRunRepository(createServiceDatabase()),
    playerId,
    now: () => new Date(),
    evaluateSemantic: (text, rules, context) => evaluateSemanticRules(text, rules, { context })
  };
}

export function jsonError(error: unknown) {
  const known = error instanceof RunServiceError
    ? error
    : new RunServiceError('SERVICE_UNAVAILABLE', 'The lava is restless. Try again.', 503, true);
  return NextResponse.json({
    error: { code: known.code, message: known.message, retryable: known.retryable }
  }, { status: known.status, headers: { 'Cache-Control': 'no-store' } });
}
