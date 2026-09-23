import { RULES } from '@/game/rules';
import { JevUnavailableError, evaluateSemanticRules } from './jev';

const rules = RULES.filter(rule => ['suspicious_animal', 'hopeful_no_promise'].includes(rule.id));

it('batches semantic rules into one Jev request and uses yes probability', async () => {
  const calls: unknown[] = [];
  class FakeClient {
    async systemOne(payload: unknown) {
      calls.push(payload);
      return {
        answers: {
          suspicious_animal: { choice: 'yes', probabilities: { yes: 0.82, no: 0.18 } },
          hopeful_no_promise: { choice: 'no', probabilities: { yes: 0.42, no: 0.58 } }
        }
      };
    }
  }

  const verdicts = await evaluateSemanticRules('The fox may improve tomorrow.', rules, {
    apiKey: 'test-key',
    Client: FakeClient
  });
  expect(calls).toHaveLength(1);
  expect(verdicts.map(({ passed, probability }) => ({ passed, probability }))).toEqual([
    { passed: true, probability: 0.82 },
    { passed: false, probability: 0.42 }
  ]);
});

async function runWithAnswer(answer: unknown) {
  class FakeClient {
    async systemOne() {
      return { answers: { suspicious_animal: answer } };
    }
  }
  return evaluateSemanticRules('A fox knows too much.', [rules[0]], { apiKey: 'test-key', Client: FakeClient });
}

it.each([
  undefined,
  { choice: 'maybe', probabilities: { yes: 0.5, no: 0.5 } },
  { choice: 'yes', probabilities: { yes: Number.NaN, no: 0 } },
  { choice: 'yes', probabilities: { yes: 1.2, no: -0.2 } },
  { choice: 'yes', probabilities: { yes: 0.7 } }
])('rejects malformed Jev answer %#', async answer => {
  await expect(runWithAnswer(answer)).rejects.toBeInstanceOf(JevUnavailableError);
});

it('rejects answer keys that were not requested', async () => {
  class FakeClient {
    async systemOne() {
      return {
        answers: {
          suspicious_animal: { choice: 'yes', probabilities: { yes: 0.7, no: 0.3 } },
          unknown_rule: { choice: 'yes', probabilities: { yes: 0.7, no: 0.3 } }
        }
      };
    }
  }
  await expect(evaluateSemanticRules('A fox knows too much.', [rules[0]], { apiKey: 'test-key', Client: FakeClient }))
    .rejects.toBeInstanceOf(JevUnavailableError);
});

it('wraps provider errors without exposing secrets or raw bodies', async () => {
  class FakeClient {
    async systemOne() {
      throw new Error('test-key: raw provider body');
    }
  }
  const promise = evaluateSemanticRules('A fox knows too much.', [rules[0]], { apiKey: 'test-key', Client: FakeClient });
  await expect(promise).rejects.toBeInstanceOf(JevUnavailableError);
  await expect(promise).rejects.not.toThrow(/test-key|raw provider body/u);
});
