import { activeRules, challengeDate, dailySequence, nextResetAt } from './daily';

describe('daily challenge sequence', () => {
  it('is deterministic per UTC date and changes the next day', () => {
    const first = dailySequence('2026-09-23', 40);
    expect(dailySequence('2026-09-23', 40)).toEqual(first);
    expect(dailySequence('2026-09-24', 40)).not.toEqual(first);
  });

  it('keeps a unique stack of up to four rules with a semantic judge', () => {
    for (let round = 0; round < 40; round += 1) {
      const stack = activeRules('2026-09-23', round);
      expect(stack.length).toBeLessThanOrEqual(4);
      expect(new Set(stack.map(rule => rule.id)).size).toBe(stack.length);
      expect(stack.some(rule => rule.evaluator === 'semantic')).toBe(true);
    }
  });

  it('uses UTC challenge boundaries', () => {
    expect(challengeDate(new Date('2026-09-23T23:59:59Z'))).toBe('2026-09-23');
    expect(nextResetAt(new Date('2026-09-23T20:00:00Z')).toISOString()).toBe('2026-09-24T00:00:00.000Z');
  });
});
