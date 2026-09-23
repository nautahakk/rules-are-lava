import { codeCritter, getOrCreatePlayerId, uniqueCritterName, validPlayerId } from './identity';

describe('anonymous identity', () => {
  it('accepts only UUID player ids', () => {
    expect(validPlayerId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(validPlayerId('not-a-player')).toBe(false);
  });

  it('creates stable collision-safe Code Critters', () => {
    const playerId = '550e8400-e29b-41d4-a716-446655440000';
    expect(codeCritter(playerId)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(uniqueCritterName('Binary Badger', new Set(['Binary Badger']), playerId)).toMatch(/^Binary Badger · \d{2}$/);
  });

  it('replaces an invalid cookie with a fresh strict cookie', async () => {
    const writes: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const store = {
      get: () => ({ value: 'not-a-player' }),
      set: (name: string, value: string, options: Record<string, unknown>) => writes.push({ name, value, options })
    };

    const playerId = await getOrCreatePlayerId(store);
    expect(validPlayerId(playerId)).toBe(true);
    expect(writes).toEqual([expect.objectContaining({
      name: 'ral_player',
      value: playerId,
      options: expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/' })
    })]);
  });
});
