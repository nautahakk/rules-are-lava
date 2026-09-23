import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { Game } from './game';

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  }));
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

it('shows one play action and a quiet daily teaser before the run', async () => {
  vi.stubGlobal('fetch', vi.fn(() => json({
    topScore: 14,
    top: [],
    player: null,
    resetAt: '2026-09-24T00:00:00.000Z',
    csrfToken: '550e8400-e29b-41d4-a716-446655440000'
  })));

  render(<Game />);
  expect(await screen.findByText("Today's best: 14 rounds")).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: "Play today's challenge" })).toHaveLength(1);
  expect(screen.queryByRole('heading', { name: "Today's Survivors" })).not.toBeInTheDocument();
});

it('keeps Enter multiline, submits with Ctrl+Enter, and shows mixed verdicts', async () => {
  let resolveAnswer!: (response: Response) => void;
  const run = {
    id: 'run-1', challengeDate: '2026-09-23', roundIndex: 0, lives: 3, score: 0,
    status: 'active', deadlineAt: '2099-09-23T12:00:30.000Z', critterName: 'Binary Badger',
    activeRules: [
      { id: 'suspicious_animal', label: 'Make an animal sound suspicious.', evaluator: 'semantic' },
      { id: 'six_words', label: 'Use exactly six words.', evaluator: 'deterministic' },
      { id: 'no_e', label: 'Do not use the letter E.', evaluator: 'deterministic' },
      { id: 'question_end', label: 'End with a question mark.', evaluator: 'deterministic' }
    ],
    lastFailure: null
  };
  const fetchMock = vi.fn()
    .mockImplementationOnce(() => json({
      topScore: 14, top: [], player: null, resetAt: '2099-09-24T00:00:00.000Z',
      csrfToken: '550e8400-e29b-41d4-a716-446655440000'
    }))
    .mockImplementationOnce(() => json(run))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { resolveAnswer = resolve; }));
  vi.stubGlobal('fetch', fetchMock);

  render(<Game />);
  fireEvent.click(await screen.findByRole('button', { name: "Play today's challenge" }));
  const input = await screen.findByRole('textbox', { name: 'Your response' });
  fireEvent.change(input, { target: { value: 'line one\nline two' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(fetchMock).toHaveBeenCalledTimes(2);

  const max = 'x'.repeat(160);
  fireEvent.change(input, { target: { value: max } });
  expect(input).toHaveValue(max);
  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
  expect(screen.getByRole('button', { name: 'Checking with Jev…' })).toBeDisabled();

  await act(async () => resolveAnswer(await json({
    ...run,
    roundIndex: 1,
    lives: 2,
    activeRules: run.activeRules,
    lastFailure: { ruleId: 'six_words', label: 'Use exactly six words.', evaluator: 'deterministic' },
    verdicts: [
      { ruleId: 'suspicious_animal', label: 'Make an animal sound suspicious.', evaluator: 'semantic', passed: true, probability: 0.78 },
      { ruleId: 'six_words', label: 'Use exactly six words.', evaluator: 'deterministic', passed: false, detail: '5 of 6 words' }
    ]
  })));

  expect(await screen.findByText('Pass · 78%')).toBeInTheDocument();
  expect(screen.getByText('5 of 6 words')).toBeInTheDocument();
  expect(screen.getByText('2 lives')).toBeInTheDocument();
});

it.each([
  { prior: null, score: 5, announced: true, stored: '5' },
  { prior: '10', score: 5, announced: false, stored: '10' },
  { prior: '10', score: 12, announced: true, stored: '12' }
])('tracks personal bests after game over: %#', async ({ prior, score, announced, stored }) => {
  sessionStorage.setItem('ral_run', '550e8400-e29b-41d4-a716-446655440000');
  if (prior) localStorage.setItem('ral_personal_best', prior);
  const board = {
    topScore: 14,
    top: [{ rank: 1, critterName: 'Binary Badger', score: 14, isPlayer: false }],
    player: { rank: 4, critterName: 'Pixel Panda', score, isPlayer: true },
    resetAt: '2099-09-24T00:00:00.000Z',
    csrfToken: '550e8400-e29b-41d4-a716-446655440000'
  };
  const completed = {
    id: '550e8400-e29b-41d4-a716-446655440000', challengeDate: '2026-09-23', roundIndex: score + 3,
    lives: 0, score, status: 'completed', deadlineAt: null, critterName: 'Pixel Panda', activeRules: [],
    lastFailure: { ruleId: 'suspicious_animal', label: 'Make an animal sound suspicious.', evaluator: 'semantic' }
  };
  vi.stubGlobal('fetch', vi.fn()
    .mockImplementationOnce(() => json(board))
    .mockImplementationOnce(() => json(completed))
    .mockImplementationOnce(() => json(board)));

  render(<Game />);
  expect(await screen.findByRole('heading', { name: 'Run melted' })).toBeInTheDocument();
  if (announced) expect(await screen.findByText('New personal best')).toBeInTheDocument();
  else expect(screen.queryByText('New personal best')).not.toBeInTheDocument();
  await waitFor(() => expect(localStorage.getItem('ral_personal_best')).toBe(stored));
  expect(await screen.findByRole('heading', { name: "Today's Survivors" })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Share on X' })).toHaveAttribute('href', expect.stringContaining('x.com/intent/post'));
});

it('clears a restored draft after an expired round advances', async () => {
  sessionStorage.setItem('ral_run', '550e8400-e29b-41d4-a716-446655440000');
  sessionStorage.setItem('ral_draft', 'unfinished thought');
  const expired = {
    id: '550e8400-e29b-41d4-a716-446655440000', challengeDate: '2026-09-23', roundIndex: 0,
    lives: 3, score: 0, status: 'active', deadlineAt: '2020-09-23T12:00:00.000Z',
    critterName: 'Pixel Panda', activeRules: [{ id: 'mars_event', label: 'Mention Mars.', evaluator: 'semantic' }],
    lastFailure: null
  };
  const board = {
    topScore: 0, top: [], player: null, resetAt: '2099-09-24T00:00:00.000Z',
    csrfToken: '550e8400-e29b-41d4-a716-446655440000'
  };
  vi.stubGlobal('fetch', vi.fn()
    .mockImplementationOnce(() => json(board))
    .mockImplementationOnce(() => json(expired))
    .mockImplementationOnce(() => json({
      ...expired, roundIndex: 1, lives: 2, deadlineAt: '2099-09-23T12:00:30.000Z', verdicts: []
    })));

  render(<Game />);
  const input = await screen.findByRole('textbox', { name: 'Your response' });
  await waitFor(() => {
    expect(input).toHaveValue('');
    expect(sessionStorage.getItem('ral_draft')).toBeNull();
  });
});
