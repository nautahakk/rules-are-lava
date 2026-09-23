import { applyRoundResult } from './engine';

it('advances score, lives, and completion state', () => {
  const start = { roundIndex: 0, lives: 3, score: 0, status: 'active' } as const;
  expect(applyRoundResult(start, true)).toEqual({ roundIndex: 1, lives: 3, score: 1, status: 'active' });
  expect(applyRoundResult(start, false)).toEqual({ roundIndex: 1, lives: 2, score: 0, status: 'active' });
  expect(applyRoundResult({ ...start, lives: 1 }, false)).toEqual({ roundIndex: 1, lives: 0, score: 0, status: 'completed' });
});

it('does not change a completed run', () => {
  const completed = { roundIndex: 4, lives: 0, score: 2, status: 'completed' } as const;
  expect(applyRoundResult(completed, true)).toBe(completed);
});
