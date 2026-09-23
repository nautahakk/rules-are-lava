import type { RunStatus } from '@/game/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export type RunRecord = {
  id: string;
  playerId: string;
  challengeDate: string;
  roundIndex: number;
  lives: number;
  score: number;
  status: RunStatus;
  deadlineAt: string | null;
  critterName: string;
  lastFailedRuleId: string | null;
  lastFailedEvaluator: 'deterministic' | 'semantic' | null;
  completedAt: string | null;
};

export type LeaderboardResult = {
  top: Array<{ rank: number; critterName: string; score: number; isPlayer: boolean }>;
  player: { rank: number; critterName: string; score: number; isPlayer: true } | null;
};

export interface RunRepository {
  createRun(input: Omit<RunRecord, 'id'>): Promise<RunRecord>;
  findOwnedRun(id: string, playerId: string): Promise<RunRecord | null>;
  critterForPlayerDay(date: string, playerId: string): Promise<string | null>;
  namesForDay(date: string): Promise<Set<string>>;
  advanceRun(id: string, playerId: string, expectedRound: number, next: RunRecord): Promise<RunRecord | null>;
  refreshDeadline(id: string, playerId: string, expectedRound: number, deadlineAt: string): Promise<RunRecord | null>;
  leaderboard(date: string, playerId: string): Promise<LeaderboardResult>;
}

type RunRow = {
  id: string;
  player_id: string;
  challenge_date: string;
  round_index: number;
  lives: number;
  score: number;
  status: RunStatus;
  deadline_at: string | null;
  critter_name: string;
  last_failed_rule_id: string | null;
  last_failed_evaluator: 'deterministic' | 'semantic' | null;
  completed_at: string | null;
};

type RankedRow = {
  player_id: string;
  rank: number;
  score: number;
  critter_name: string;
};

export function mapRunRow(row: RunRow): RunRecord {
  return {
    id: row.id,
    playerId: row.player_id,
    challengeDate: row.challenge_date,
    roundIndex: row.round_index,
    lives: row.lives,
    score: row.score,
    status: row.status,
    deadlineAt: row.deadline_at,
    critterName: row.critter_name,
    lastFailedRuleId: row.last_failed_rule_id,
    lastFailedEvaluator: row.last_failed_evaluator,
    completedAt: row.completed_at
  };
}

function toRunRow(run: Omit<RunRecord, 'id'>) {
  return {
    player_id: run.playerId,
    challenge_date: run.challengeDate,
    round_index: run.roundIndex,
    lives: run.lives,
    score: run.score,
    status: run.status,
    deadline_at: run.deadlineAt,
    critter_name: run.critterName,
    last_failed_rule_id: run.lastFailedRuleId,
    last_failed_evaluator: run.lastFailedEvaluator,
    completed_at: run.completedAt,
    updated_at: new Date().toISOString()
  };
}

function fail(error: { message?: string } | null) {
  if (error) throw new Error(error.message ?? 'Database operation failed');
}

export class SupabaseRunRepository implements RunRepository {
  constructor(private readonly database: SupabaseClient) {}

  async createRun(input: Omit<RunRecord, 'id'>): Promise<RunRecord> {
    const { data, error } = await this.database.from('runs').insert(toRunRow(input)).select().single();
    fail(error);
    return mapRunRow(data as RunRow);
  }

  async findOwnedRun(id: string, playerId: string): Promise<RunRecord | null> {
    const { data, error } = await this.database.from('runs').select('*').eq('id', id).eq('player_id', playerId).maybeSingle();
    fail(error);
    return data ? mapRunRow(data as RunRow) : null;
  }

  async critterForPlayerDay(date: string, playerId: string): Promise<string | null> {
    const { data, error } = await this.database.from('runs')
      .select('critter_name')
      .eq('challenge_date', date)
      .eq('player_id', playerId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    fail(error);
    return data ? String(data.critter_name) : null;
  }

  async namesForDay(date: string): Promise<Set<string>> {
    const { data, error } = await this.database.from('runs').select('critter_name').eq('challenge_date', date);
    fail(error);
    return new Set((data ?? []).map(row => String(row.critter_name)));
  }

  async advanceRun(id: string, playerId: string, expectedRound: number, next: RunRecord): Promise<RunRecord | null> {
    const { data, error } = await this.database.from('runs')
      .update(toRunRow(next))
      .eq('id', id)
      .eq('player_id', playerId)
      .eq('round_index', expectedRound)
      .eq('status', 'active')
      .select()
      .maybeSingle();
    fail(error);
    return data ? mapRunRow(data as RunRow) : null;
  }

  async refreshDeadline(id: string, playerId: string, expectedRound: number, deadlineAt: string): Promise<RunRecord | null> {
    const { data, error } = await this.database.from('runs')
      .update({ deadline_at: deadlineAt, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('player_id', playerId)
      .eq('round_index', expectedRound)
      .eq('status', 'active')
      .select()
      .maybeSingle();
    fail(error);
    return data ? mapRunRow(data as RunRow) : null;
  }

  async leaderboard(date: string, playerId: string): Promise<LeaderboardResult> {
    const topQuery = await this.database.from('ranked_daily_scores')
      .select('player_id, rank, score, critter_name, completed_at')
      .eq('challenge_date', date)
      .order('score', { ascending: false })
      .order('completed_at', { ascending: true })
      .limit(10);
    fail(topQuery.error);

    const playerQuery = await this.database.from('ranked_daily_scores')
      .select('player_id, rank, score, critter_name')
      .eq('challenge_date', date)
      .eq('player_id', playerId)
      .maybeSingle();
    fail(playerQuery.error);

    const entry = (row: RankedRow, isPlayer: boolean) => ({
      rank: Number(row.rank),
      critterName: row.critter_name,
      score: row.score,
      isPlayer
    });
    return {
      top: (topQuery.data ?? []).map(row => entry(row as RankedRow, row.player_id === playerId)),
      player: playerQuery.data ? { ...entry(playerQuery.data as RankedRow, true), isPlayer: true as const } : null
    };
  }
}
