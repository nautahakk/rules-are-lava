import { RULES } from './rules';
import type { EvaluatorKind, Rule } from './types';

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
  };
}

function shuffled(date: string, category: EvaluatorKind, cycle: number): Rule[] {
  const result = RULES.filter(rule => rule.evaluator === category).slice();
  const random = mulberry32(fnv1a(`${date}:${category}:${cycle}`));
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function challengeDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function nextResetAt(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export function dailySequence(date: string, count: number): Rule[] {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('count must be a non-negative integer');

  const emitted: Rule[] = [];
  const cycles: Record<EvaluatorKind, number> = { semantic: 0, deterministic: 0 };
  const queues: Record<EvaluatorKind, Rule[]> = {
    semantic: shuffled(date, 'semantic', 0),
    deterministic: shuffled(date, 'deterministic', 0)
  };

  while (emitted.length < count) {
    const category: EvaluatorKind = emitted.length % 2 === 0 ? 'semantic' : 'deterministic';
    const recent = new Set(emitted.slice(-4).map(rule => rule.id));
    let candidate = queues[category].find(rule => !recent.has(rule.id));

    if (!candidate) {
      cycles[category] += 1;
      queues[category] = shuffled(date, category, cycles[category]);
      candidate = queues[category].find(rule => !recent.has(rule.id));
    }
    if (!candidate) throw new Error(`Rule catalogue cannot fill ${category} sequence`);

    queues[category].splice(queues[category].indexOf(candidate), 1);
    emitted.push(candidate);
  }
  return emitted;
}

export function activeRules(date: string, roundIndex: number): Rule[] {
  if (!Number.isInteger(roundIndex) || roundIndex < 0) throw new RangeError('roundIndex must be a non-negative integer');
  return dailySequence(date, roundIndex + 1).slice(-4);
}
