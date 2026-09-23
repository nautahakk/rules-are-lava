import type { RunState } from './types';

export function applyRoundResult(state: RunState, passed: boolean): RunState {
  if (state.status !== 'active') return state;
  const lives = passed ? state.lives : state.lives - 1;
  return {
    roundIndex: state.roundIndex + 1,
    lives,
    score: state.score + (passed ? 1 : 0),
    status: lives === 0 ? 'completed' : 'active'
  };
}
