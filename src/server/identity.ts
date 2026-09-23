import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';

const TERMS = ['Binary', 'Cache', 'Lambda', 'Pixel', 'Prompt', 'Stack', 'Syntax', 'Turbo'] as const;
const ANIMALS = ['Badger', 'Capybara', 'Gecko', 'Mantis', 'Otter', 'Panda', 'Raven', 'Yak'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

type PlayerCookieStore = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: Record<string, unknown>): unknown;
};

function hash(value: string): number {
  let result = 0x811c9dc5;
  for (const character of value) {
    result ^= character.codePointAt(0) ?? 0;
    result = Math.imul(result, 0x01000193);
  }
  return result >>> 0;
}

export function validPlayerId(value: string | undefined): value is string {
  return Boolean(value && UUID.test(value));
}

export function codeCritter(playerId: string): string {
  const seed = hash(playerId);
  return `${TERMS[seed % TERMS.length]} ${ANIMALS[Math.floor(seed / TERMS.length) % ANIMALS.length]}`;
}

export function uniqueCritterName(base: string, taken: Set<string>, playerId: string): string {
  if (!taken.has(base)) return base;
  return `${base} · ${String(hash(playerId) % 100).padStart(2, '0')}`;
}

export async function getOrCreatePlayerId(store?: PlayerCookieStore): Promise<string> {
  const cookieStore = store ?? await cookies();
  const existing = cookieStore.get('ral_player')?.value;
  if (validPlayerId(existing)) return existing;

  const playerId = randomUUID();
  cookieStore.set('ral_player', playerId, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365
  });
  return playerId;
}
