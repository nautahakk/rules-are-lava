import type { Rule, RuleVerdict } from '@/game/types';
import { JevUnavailableError } from './jev';
import { MemoryRunRepository } from './test-memory-repository';
import { RunServiceError, restoreRun, startRun, submitRound } from './run-service';

const playerId = '550e8400-e29b-41d4-a716-446655440000';
const passing = async (_text: string, rules: readonly Rule[]): Promise<RuleVerdict[]> => rules.map(rule => ({
  ruleId: rule.id, label: rule.label, evaluator: 'semantic', passed: true, probability: 0.8
}));

function setup(start = new Date('2026-09-23T12:00:00.000Z')) {
  const repo = new MemoryRunRepository();
  let current = start;
  return {
    repo,
    deps: { repo, playerId, now: () => current, evaluateSemantic: passing },
    setNow: (next: Date) => { current = next; }
  };
}

describe('authoritative run service', () => {
  it('starts three-life daily runs with one rule and a 30-second deadline', async () => {
    const { deps } = setup();
    const run = await startRun(deps);
    expect(run.lives).toBe(3);
    expect(run.activeRules).toHaveLength(1);
    expect(new Date(run.deadlineAt!).getTime() - deps.now().getTime()).toBe(30_000);
  });

  it.each(['', '   ', 'x'.repeat(161)])('rejects invalid response %j before evaluation or mutation', async text => {
    const { deps, repo } = setup();
    const run = await startRun(deps);
    const before = structuredClone(repo.record);
    let calls = 0;
    const guarded = { ...deps, evaluateSemantic: async () => { calls += 1; return []; } };
    await expect(submitRound(run.id, { kind: 'answer', expectedRound: 0, text }, guarded))
      .rejects.toMatchObject({ code: 'INVALID_SUBMISSION' });
    expect(repo.record).toEqual(before);
    expect(calls).toBe(0);
  });

  it('passes semantic and deterministic verdicts without losing a life', async () => {
    const { deps } = setup();
    const started = await startRun(deps);
    const first = await submitRound(started.id, { kind: 'answer', expectedRound: 0, text: 'A fox schemes quietly.' }, deps);
    const second = await submitRound(started.id, { kind: 'answer', expectedRound: 1, text: 'Ash fox slyly jumps 7 now?' }, deps);
    expect(first.score).toBe(1);
    expect(second).toMatchObject({ score: 2, lives: 3 });
    expect(second.verdicts.some(verdict => verdict.evaluator === 'deterministic')).toBe(true);
    expect(second.verdicts.every(verdict => verdict.passed)).toBe(true);
  });

  it('stores failed-rule metadata but never the response', async () => {
    const { deps, repo } = setup();
    const run = await startRun(deps);
    const failing = {
      ...deps,
      evaluateSemantic: async (_text: string, rules: readonly Rule[]) => rules.map(rule => ({
        ruleId: rule.id, label: rule.label, evaluator: 'semantic' as const, passed: false, probability: 0.2
      }))
    };
    const response = 'private-ember-phrase';
    const result = await submitRound(run.id, { kind: 'answer', expectedRound: 0, text: response }, failing);
    expect(result).toMatchObject({ score: 0, lives: 2, lastFailure: { evaluator: 'semantic' } });
    expect(JSON.stringify(repo.record)).not.toContain(response);
    expect(repo.record).not.toHaveProperty('text');
  });

  it('rejects an early timeout and applies one loss at the deadline', async () => {
    const { deps, repo, setNow } = setup();
    const run = await startRun(deps);
    setNow(new Date('2026-09-23T12:00:29.999Z'));
    await expect(submitRound(run.id, { kind: 'timeout', expectedRound: 0 }, deps))
      .rejects.toMatchObject({ code: 'ROUND_ACTIVE' });
    expect(repo.record.roundIndex).toBe(0);
    setNow(new Date('2026-09-23T12:00:30.000Z'));
    await expect(submitRound(run.id, { kind: 'timeout', expectedRound: 0 }, deps))
      .resolves.toMatchObject({ roundIndex: 1, lives: 2, score: 0 });
  });

  it('clears failed-rule metadata when the final loss is a timeout', async () => {
    const { deps, repo, setNow } = setup();
    const run = await startRun(deps);
    const failing = { ...deps, evaluateSemantic: async (_text: string, rules: readonly Rule[]) => rules.map(rule => ({
      ruleId: rule.id, label: rule.label, evaluator: 'semantic' as const, passed: false, probability: 0.2
    })) };
    await submitRound(run.id, { kind: 'answer', expectedRound: 0, text: 'A fox schemes.' }, failing);
    expect(repo.record.lastFailedRuleId).not.toBeNull();
    setNow(new Date(repo.record.deadlineAt!));
    await submitRound(run.id, { kind: 'timeout', expectedRound: 1 }, deps);
    expect(repo.record.lastFailedRuleId).toBeNull();
    expect(repo.record.lastFailedEvaluator).toBeNull();
  });

  it('extends the same round after Jev is unavailable', async () => {
    const { deps, repo, setNow } = setup();
    const run = await startRun(deps);
    const before = structuredClone(repo.record);
    setNow(new Date('2026-09-23T12:00:05.000Z'));
    const unavailable = { ...deps, evaluateSemantic: async () => { throw new JevUnavailableError(); } };
    const promise = submitRound(run.id, { kind: 'answer', expectedRound: 0, text: 'A fox schemes.' }, unavailable);
    await expect(promise).rejects.toBeInstanceOf(RunServiceError);
    await expect(promise).rejects.toMatchObject({ code: 'JEV_UNAVAILABLE', retryable: true });
    expect(repo.record).toEqual({ ...before, deadlineAt: '2026-09-23T12:00:35.000Z' });
  });

  it('completes at zero lives and ignores later submissions', async () => {
    const { deps, repo, setNow } = setup();
    const run = await startRun(deps);
    for (let round = 0; round < 3; round += 1) {
      setNow(new Date(repo.record.deadlineAt!));
      await submitRound(run.id, { kind: 'timeout', expectedRound: round }, deps);
    }
    expect(repo.record).toMatchObject({ lives: 0, status: 'completed', deadlineAt: null });
    const completed = structuredClone(repo.record);
    await expect(submitRound(run.id, { kind: 'answer', expectedRound: 3, text: 'Anything' }, deps))
      .resolves.toMatchObject({ status: 'completed' });
    expect(repo.record).toEqual(completed);
  });

  it('keeps the starting challenge date after midnight', async () => {
    const { deps, setNow } = setup(new Date('2026-09-23T23:59:50.000Z'));
    const run = await startRun(deps);
    setNow(new Date('2026-09-24T00:00:00.000Z'));
    const result = await submitRound(run.id, { kind: 'answer', expectedRound: 0, text: 'A fox schemes.' }, deps);
    expect(result.challengeDate).toBe('2026-09-23');
  });

  it('advances simultaneous submissions only once', async () => {
    const { deps, repo } = setup();
    const run = await startRun(deps);
    const results = await Promise.all([
      submitRound(run.id, { kind: 'answer', expectedRound: 0, text: 'A fox schemes.' }, deps),
      submitRound(run.id, { kind: 'answer', expectedRound: 0, text: 'A fox schemes.' }, deps)
    ]);
    expect(repo.record.roundIndex).toBe(1);
    expect(repo.record.score).toBe(1);
    expect(results.every(result => result.roundIndex === 1)).toBe(true);
  });

  it('restores an expired run without mutating through GET semantics', async () => {
    const { deps, repo, setNow } = setup();
    const run = await startRun(deps);
    const before = structuredClone(repo.record);
    setNow(new Date(run.deadlineAt!));
    await expect(restoreRun(run.id, deps)).resolves.toMatchObject({ roundIndex: 0, lives: 3 });
    expect(repo.record).toEqual(before);
  });
});
