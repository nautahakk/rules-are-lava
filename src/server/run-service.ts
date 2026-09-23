import { z } from 'zod';
import type { Rule, RuleVerdict } from '@/game/types';
import { activeRules, challengeDate } from '@/game/daily';
import { applyRoundResult } from '@/game/engine';
import { RULES, evaluateDeterministicRule } from '@/game/rules';
import { codeCritter, uniqueCritterName } from './identity';
import { JevUnavailableError } from './jev';
import type { RunRecord, RunRepository } from './run-repository';

export type ClientRunState = {
  id: string;
  challengeDate: string;
  roundIndex: number;
  lives: number;
  score: number;
  status: 'active' | 'completed';
  deadlineAt: string | null;
  critterName: string;
  activeRules: Array<Pick<Rule, 'id' | 'label' | 'evaluator'>>;
  lastFailure: { ruleId: string; label: string; evaluator: 'deterministic' | 'semantic' } | null;
};

export type RoundResult = ClientRunState & { verdicts: RuleVerdict[] };

export const submissionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('answer'), expectedRound: z.number().int().nonnegative(), text: z.string().trim().min(1).max(160) }),
  z.object({ kind: z.literal('timeout'), expectedRound: z.number().int().nonnegative() })
]);

export class RunServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'RunServiceError';
  }
}

export type RunServiceDeps = {
  repo: RunRepository;
  playerId: string;
  now: () => Date;
  evaluateSemantic: (
    text: string,
    rules: readonly Rule[],
    context: { challengeDate: string; roundIndex: number }
  ) => Promise<RuleVerdict[]>;
};

const deadlineAfter = (now: Date) => new Date(now.getTime() + 30_000).toISOString();

export function clientRunState(run: RunRecord): ClientRunState {
  const round = run.status === 'completed' ? Math.max(0, run.roundIndex - 1) : run.roundIndex;
  const stack = activeRules(run.challengeDate, round).map(({ id, label, evaluator }) => ({ id, label, evaluator }));
  const failedRule = run.lastFailedRuleId ? RULES.find(rule => rule.id === run.lastFailedRuleId) : null;
  return {
    id: run.id,
    challengeDate: run.challengeDate,
    roundIndex: run.roundIndex,
    lives: run.lives,
    score: run.score,
    status: run.status,
    deadlineAt: run.deadlineAt,
    critterName: run.critterName,
    activeRules: stack,
    lastFailure: run.lastFailedRuleId && run.lastFailedEvaluator ? {
      ruleId: run.lastFailedRuleId,
      label: failedRule?.label ?? run.lastFailedRuleId,
      evaluator: run.lastFailedEvaluator
    } : null
  };
}

export async function startRun(deps: RunServiceDeps): Promise<ClientRunState> {
  const now = deps.now();
  const date = challengeDate(now);
  const existingName = await deps.repo.critterForPlayerDay(date, deps.playerId);
  const critterName = existingName ?? uniqueCritterName(
    codeCritter(deps.playerId),
    await deps.repo.namesForDay(date),
    deps.playerId
  );
  const run = await deps.repo.createRun({
    playerId: deps.playerId,
    challengeDate: date,
    roundIndex: 0,
    lives: 3,
    score: 0,
    status: 'active',
    deadlineAt: deadlineAfter(now),
    critterName,
    lastFailedRuleId: null,
    lastFailedEvaluator: null,
    completedAt: null
  });
  return clientRunState(run);
}

async function ownedRun(runId: string, deps: RunServiceDeps): Promise<RunRecord> {
  const run = await deps.repo.findOwnedRun(runId, deps.playerId);
  if (!run) throw new RunServiceError('RUN_NOT_FOUND', 'Run not found.', 404);
  return run;
}

async function advance(
  run: RunRecord,
  passed: boolean,
  failed: RuleVerdict | null,
  verdicts: RuleVerdict[],
  deps: RunServiceDeps
): Promise<RoundResult> {
  const now = deps.now();
  const state = applyRoundResult(run, passed);
  const next: RunRecord = {
    ...run,
    ...state,
    deadlineAt: state.status === 'active' ? deadlineAfter(now) : null,
    lastFailedRuleId: failed?.ruleId ?? null,
    lastFailedEvaluator: failed?.evaluator ?? null,
    completedAt: state.status === 'completed' ? now.toISOString() : null
  };
  const saved = await deps.repo.advanceRun(run.id, deps.playerId, run.roundIndex, next);
  if (saved) return { ...clientRunState(saved), verdicts };

  const current = await ownedRun(run.id, deps);
  return { ...clientRunState(current), verdicts: [] };
}

export async function submitRound(runId: string, input: unknown, deps: RunServiceDeps): Promise<RoundResult> {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) throw new RunServiceError('INVALID_SUBMISSION', 'Enter 1–160 characters.', 400);

  const run = await ownedRun(runId, deps);
  if (run.status === 'completed' || parsed.data.expectedRound !== run.roundIndex) {
    return { ...clientRunState(run), verdicts: [] };
  }

  const now = deps.now();
  const expired = !run.deadlineAt || now.getTime() >= new Date(run.deadlineAt).getTime();
  if (parsed.data.kind === 'timeout') {
    if (!expired) throw new RunServiceError('ROUND_ACTIVE', 'The round still has time left.', 409);
    return advance(run, false, null, [], deps);
  }
  if (expired) return advance(run, false, null, [], deps);

  const text = parsed.data.text;
  const rules = activeRules(run.challengeDate, run.roundIndex);
  const deterministic = rules
    .filter(rule => rule.evaluator === 'deterministic')
    .map(rule => evaluateDeterministicRule(rule.id, text));
  const semanticRules = rules.filter(rule => rule.evaluator === 'semantic');
  let semantic: RuleVerdict[];
  try {
    semantic = await deps.evaluateSemantic(text, semanticRules, {
      challengeDate: run.challengeDate,
      roundIndex: run.roundIndex
    });
  } catch (error) {
    if (!(error instanceof JevUnavailableError)) throw error;
    await deps.repo.refreshDeadline(run.id, deps.playerId, run.roundIndex, deadlineAfter(now));
    throw new RunServiceError('JEV_UNAVAILABLE', 'Jev slipped into the lava. Try again.', 503, true);
  }

  const byRule = new Map([...deterministic, ...semantic].map(verdict => [verdict.ruleId, verdict]));
  const verdicts = rules.map(rule => byRule.get(rule.id)).filter((verdict): verdict is RuleVerdict => Boolean(verdict));
  if (verdicts.length !== rules.length) {
    await deps.repo.refreshDeadline(run.id, deps.playerId, run.roundIndex, deadlineAfter(now));
    throw new RunServiceError('JEV_UNAVAILABLE', 'Jev slipped into the lava. Try again.', 503, true);
  }
  const failed = verdicts.find(verdict => !verdict.passed) ?? null;
  return advance(run, !failed, failed, verdicts, deps);
}

export async function restoreRun(runId: string, deps: RunServiceDeps): Promise<ClientRunState> {
  return clientRunState(await ownedRun(runId, deps));
}
