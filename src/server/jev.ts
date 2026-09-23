import { choice, TypeSafeClient } from '@typesafe-ai/sdk';
import type { Rule, RuleVerdict } from '@/game/types';
import { serverEnv } from './env';

type ClientInstance = {
  systemOne(payload: unknown, options?: unknown): Promise<unknown>;
};

type ClientConstructor = new (config: {
  apiKey: string;
  defaultModel: string;
  logLevel: 'off';
  retry: { maxRetries: number };
  timeout: number;
}) => ClientInstance;

type EvaluateOptions = {
  apiKey?: string;
  signal?: AbortSignal;
  Client?: ClientConstructor;
  context?: { challengeDate: string; roundIndex: number };
};

export class JevUnavailableError extends Error {
  constructor() {
    super('Jev is temporarily unavailable.');
    this.name = 'JevUnavailableError';
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function probability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export async function evaluateSemanticRules(
  text: string,
  rules: readonly Rule[],
  options: EvaluateOptions = {}
): Promise<RuleVerdict[]> {
  if (rules.length === 0) return [];
  if (rules.some(rule => rule.evaluator !== 'semantic' || !rule.question)) {
    throw new TypeError('evaluateSemanticRules accepts only semantic rules with questions');
  }

  try {
    const apiKey = options.apiKey ?? serverEnv().TYPESAFE_API_KEY;
    const Client = options.Client ?? TypeSafeClient as unknown as ClientConstructor;
    const questions = Object.fromEntries(rules.map(rule => [
      rule.id,
      choice(rule.question!, {
        yes: { verdict: 'The response obeys this rule.' },
        no: { verdict: 'The response breaks this rule.' }
      })
    ]));
    const client = new Client({
      apiKey,
      defaultModel: 'jev-latest',
      logLevel: 'off',
      retry: { maxRetries: 0 },
      timeout: 2500
    });
    const response = await client.systemOne({
      state: {
        response: text,
        rules: rules.map(({ id, label }) => ({ id, label })),
        ...options.context
      },
      questions
    }, {
      signal: options.signal,
      timeout: 2500,
      retry: { maxRetries: 0 }
    });

    if (!record(response)) throw new Error('Malformed response');
    const answers = response.answers;
    if (!record(answers)) throw new Error('Malformed answers');
    const requested = new Set(rules.map(rule => rule.id));
    if (Object.keys(answers).length !== requested.size ||
      Object.keys(answers).some(key => !requested.has(key))) {
      throw new Error('Unexpected answer key');
    }

    return rules.map(rule => {
      const answer = answers[rule.id];
      if (!record(answer) || (answer.choice !== 'yes' && answer.choice !== 'no') || !record(answer.probabilities)) {
        throw new Error('Malformed answer');
      }
      const yes = answer.probabilities.yes;
      const no = answer.probabilities.no;
      if (!probability(yes) || !probability(no)) throw new Error('Malformed probabilities');
      return {
        ruleId: rule.id,
        label: rule.label,
        evaluator: 'semantic' as const,
        passed: yes >= 0.5,
        probability: yes,
        detail: `${Math.round(yes * 100)}% match`
      };
    });
  } catch {
    throw new JevUnavailableError();
  }
}
