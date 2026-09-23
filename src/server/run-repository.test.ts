import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRunRepository, mapRunRow } from './run-repository';

type Row = Record<string, unknown>;

class FakeQuery implements PromiseLike<{ data: Row[]; error: null }> {
  constructor(private rows: Row[], private log: string[]) {}
  select() { return this; }
  insert() { return this; }
  update() { return this; }
  eq(column: string, value: unknown) {
    this.log.push(`${column}=${value}`);
    this.rows = this.rows.filter(row => row[column] === value);
    return this;
  }
  order(column: string, { ascending }: { ascending: boolean }) {
    this.rows.sort((left, right) => {
      const a = left[column] as number | string;
      const b = right[column] as number | string;
      return (a < b ? -1 : a > b ? 1 : 0) * (ascending ? 1 : -1);
    });
    return this;
  }
  limit(count: number) { this.rows = this.rows.slice(0, count); return this; }
  async single() { return { data: this.rows[0] ?? null, error: null }; }
  async maybeSingle() { return this.single(); }
  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.rows, error: null }).then(onfulfilled, onrejected);
  }
}

function fakeClient(tables: Record<string, Row[]>, log: string[] = []) {
  return {
    from(table: string) { return new FakeQuery([...(tables[table] ?? [])], log); }
  } as unknown as SupabaseClient;
}

const runRow = {
  id: 'run-1',
  player_id: 'player-1',
  challenge_date: '2026-09-23',
  round_index: 2,
  lives: 2,
  score: 1,
  status: 'active',
  deadline_at: '2026-09-23T12:00:00.000Z',
  critter_name: 'Binary Badger',
  last_failed_rule_id: 'no_e',
  last_failed_evaluator: 'deterministic',
  completed_at: null
} as const;

describe('SupabaseRunRepository', () => {
  it('maps snake-case run rows and reuses a daily Code Critter', async () => {
    expect(mapRunRow(runRow)).toMatchObject({
      playerId: 'player-1', challengeDate: '2026-09-23', roundIndex: 2, critterName: 'Binary Badger'
    });
    const repository = new SupabaseRunRepository(fakeClient({ runs: [runRow] }));
    await expect(repository.critterForPlayerDay('2026-09-23', 'player-1')).resolves.toBe('Binary Badger');
  });

  it('returns a top ten with shared ranks and a pinned player from only the requested day', async () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      player_id: `player-${index + 1}`,
      challenge_date: '2026-09-23',
      rank: index < 2 ? 1 : index,
      score: index < 2 ? 20 : 20 - index,
      critter_name: `Critter ${index + 1}`,
      completed_at: `2026-09-23T00:${String(index).padStart(2, '0')}:00.000Z`
    }));
    rows.push({ player_id: 'old-winner', challenge_date: '2026-09-22', rank: 1, score: 999, critter_name: 'Old Winner', completed_at: '2026-09-22T00:00:00.000Z' });
    const repository = new SupabaseRunRepository(fakeClient({ ranked_daily_scores: rows }));

    const board = await repository.leaderboard('2026-09-23', 'player-12');
    expect(board.top).toHaveLength(10);
    expect(board.top.slice(0, 2).map(row => row.rank)).toEqual([1, 1]);
    expect(board.top.some(row => row.critterName === 'Old Winner')).toBe(false);
    expect(board.player).toMatchObject({ critterName: 'Critter 12', isPlayer: true });
  });

  it('uses one daily best per player and dense shared ranks in SQL', () => {
    const migration = readFileSync('supabase/migrations/202609230001_create_runs.sql', 'utf8');
    expect(migration).toContain('distinct on (challenge_date, player_id)');
    expect(migration).toContain('dense_rank() over (partition by challenge_date order by score desc)');
  });

  it('guards conditional advances by owner, round, and active status', async () => {
    const log: string[] = [];
    const repository = new SupabaseRunRepository(fakeClient({ runs: [runRow] }, log));
    await repository.advanceRun('run-1', 'player-1', 2, mapRunRow(runRow));
    expect(log).toEqual(expect.arrayContaining(['id=run-1', 'player_id=player-1', 'round_index=2', 'status=active']));
  });
});
