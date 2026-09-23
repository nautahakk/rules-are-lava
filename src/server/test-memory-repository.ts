import type { LeaderboardResult, RunRecord, RunRepository } from './run-repository';

const clone = <T>(value: T): T => structuredClone(value);

export class MemoryRunRepository implements RunRepository {
  records: RunRecord[] = [];

  get record() {
    const record = this.records.at(-1);
    if (!record) throw new Error('No run exists');
    return record;
  }

  async createRun(input: Omit<RunRecord, 'id'>): Promise<RunRecord> {
    const record = { ...clone(input), id: `run-${this.records.length + 1}` };
    this.records.push(record);
    return clone(record);
  }

  async findOwnedRun(id: string, playerId: string): Promise<RunRecord | null> {
    const record = this.records.find(candidate => candidate.id === id && candidate.playerId === playerId);
    return record ? clone(record) : null;
  }

  async critterForPlayerDay(date: string, playerId: string): Promise<string | null> {
    return this.records.find(record => record.challengeDate === date && record.playerId === playerId)?.critterName ?? null;
  }

  async namesForDay(date: string): Promise<Set<string>> {
    return new Set(this.records.filter(record => record.challengeDate === date).map(record => record.critterName));
  }

  async advanceRun(id: string, playerId: string, expectedRound: number, next: RunRecord): Promise<RunRecord | null> {
    const index = this.records.findIndex(record => record.id === id && record.playerId === playerId &&
      record.roundIndex === expectedRound && record.status === 'active');
    if (index < 0) return null;
    this.records[index] = clone(next);
    return clone(next);
  }

  async refreshDeadline(id: string, playerId: string, expectedRound: number, deadlineAt: string): Promise<RunRecord | null> {
    const index = this.records.findIndex(record => record.id === id && record.playerId === playerId &&
      record.roundIndex === expectedRound && record.status === 'active');
    if (index < 0) return null;
    this.records[index] = { ...this.records[index], deadlineAt };
    return clone(this.records[index]);
  }

  async leaderboard(date: string, playerId: string): Promise<LeaderboardResult> {
    const best = new Map<string, RunRecord>();
    for (const record of this.records.filter(record => record.challengeDate === date && record.status === 'completed')) {
      const existing = best.get(record.playerId);
      if (!existing || record.score > existing.score) best.set(record.playerId, record);
    }
    const sorted = [...best.values()].sort((left, right) => right.score - left.score);
    let lastScore: number | undefined;
    let rank = 0;
    const ranked = sorted.map(record => {
      if (record.score !== lastScore) rank += 1;
      lastScore = record.score;
      return { rank, critterName: record.critterName, score: record.score, isPlayer: record.playerId === playerId };
    });
    const player = ranked.find(row => row.isPlayer);
    return {
      top: ranked.slice(0, 10),
      player: player ? { ...player, isPlayer: true } : null
    };
  }
}
