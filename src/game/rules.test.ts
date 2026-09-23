import { RULES, evaluateDeterministicRule } from './rules';

describe('rule catalogue', () => {
  it('contains the complete deterministic set and enough semantic variety', () => {
    expect(RULES.filter(rule => rule.evaluator === 'deterministic').map(rule => rule.id)).toEqual([
      'six_words',
      'no_e',
      'question_end',
      'include_number'
    ]);
    expect(RULES.filter(rule => rule.evaluator === 'semantic').length).toBeGreaterThanOrEqual(6);
  });

  it('evaluates each deterministic rule', () => {
    expect(evaluateDeterministicRule('six_words', 'one two three four five six').passed).toBe(true);
    expect(evaluateDeterministicRule('six_words', 'one two three').detail).toBe('3 of 6 words');
    expect(evaluateDeterministicRule('no_e', 'Volcanic ember')).toMatchObject({ passed: false });
    expect(evaluateDeterministicRule('question_end', 'Ready now?').passed).toBe(true);
    expect(evaluateDeterministicRule('include_number', 'Take route 7').passed).toBe(true);
  });

  it('rejects semantic and unknown ids', () => {
    expect(() => evaluateDeterministicRule('mars_event', 'Dust')).toThrow();
    expect(() => evaluateDeterministicRule('missing', 'Dust')).toThrow();
  });
});
