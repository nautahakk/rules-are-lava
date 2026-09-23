'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ClientRunState, RoundResult } from '@/server/run-service';
import { Countdown } from './countdown';
import { Leaderboard } from './leaderboard';
import { RuleStack, VerdictList } from './rule-stack';
import { ShareOnX } from './share-on-x';

type GamePhase = 'ready' | 'playing' | 'submitting' | 'verdict' | 'gameover';
type Board = {
  topScore: number;
  top: Array<{ rank: number; critterName: string; score: number; isPlayer: boolean }>;
  player: { rank: number; critterName: string; score: number; isPlayer: true } | null;
  resetAt: string;
  csrfToken: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? 'The lava is restless. Try again.');
  return body as T;
}

export function Game() {
  const [phase, setPhase] = useState<GamePhase>('ready');
  const [board, setBoard] = useState<Board | null>(null);
  const [run, setRun] = useState<ClientRunState | null>(null);
  const [draft, setDraft] = useState(() => typeof window === 'undefined' ? '' : sessionStorage.getItem('ral_draft') ?? '');
  const [verdicts, setVerdicts] = useState<RoundResult['verdicts']>([]);
  const [error, setError] = useState('');
  const [newPersonalBest, setNewPersonalBest] = useState(false);
  const siteUrl = typeof window === 'undefined' ? '' : window.location.origin;

  const loadBoard = useCallback(async () => {
    const next = await requestJson<Board>('/api/leaderboard');
    setBoard(next);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadBoard();
        const runId = sessionStorage.getItem('ral_run');
        if (!runId) return;
        const restored = await requestJson<ClientRunState>(`/api/runs/${encodeURIComponent(runId)}`);
        if (!active) return;
        setRun(restored);
        if (restored.status === 'completed') {
          recordPersonalBest(restored.score);
          try { await loadBoard(); } catch { /* Keep the already loaded board. */ }
        }
        setPhase(restored.status === 'completed' ? 'gameover' : 'playing');
      } catch (caught) {
        if (!active) return;
        if (sessionStorage.getItem('ral_run')) sessionStorage.removeItem('ral_run');
        setError(caught instanceof Error ? caught.message : 'The lava is restless. Try again.');
      }
    })();
    return () => { active = false; };
  }, [loadBoard]);

  function recordPersonalBest(score: number) {
    const previous = Number(localStorage.getItem('ral_personal_best') ?? 0);
    const improved = score > previous;
    setNewPersonalBest(improved);
    if (improved) localStorage.setItem('ral_personal_best', String(score));
  }

  async function start() {
    if (!board) return;
    setError('');
    setPhase('submitting');
    try {
      const next = await requestJson<ClientRunState>('/api/runs', {
        method: 'POST',
        headers: { 'x-csrf-token': board.csrfToken }
      });
      sessionStorage.setItem('ral_run', next.id);
      setRun(next);
      setPhase('playing');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The lava is restless. Try again.');
      setPhase('ready');
    }
  }

  function updateDraft(value: string) {
    setDraft(value);
    if (value) sessionStorage.setItem('ral_draft', value);
    else sessionStorage.removeItem('ral_draft');
  }

  async function submit(kind: 'answer' | 'timeout') {
    if (!run || !board || phase === 'submitting' || run.status === 'completed') return;
    setError('');
    setPhase('submitting');
    try {
      const input = kind === 'answer'
        ? { kind, expectedRound: run.roundIndex, text: draft }
        : { kind, expectedRound: run.roundIndex };
      const next = await requestJson<RoundResult>(`/api/runs/${encodeURIComponent(run.id)}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': board.csrfToken },
        body: JSON.stringify(input)
      });
      setRun(next);
      setVerdicts(next.verdicts);
      updateDraft('');
      if (next.status === 'completed') {
        recordPersonalBest(next.score);
        try { await loadBoard(); } catch { /* The first board response remains usable. */ }
        setPhase('gameover');
      } else if (next.verdicts.length) {
        setPhase('verdict');
        window.setTimeout(() => setPhase(current => current === 'verdict' ? 'playing' : current), 1800);
      } else {
        setPhase('playing');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The lava is restless. Try again.');
      setPhase('playing');
    }
  }

  function playAgain() {
    sessionStorage.removeItem('ral_run');
    updateDraft('');
    setRun(null);
    setVerdicts([]);
    setNewPersonalBest(false);
    setPhase('ready');
  }

  return (
    <main className="site-shell">
      <section className="game-shell" aria-labelledby="game-title">
        <header className="game-header">
          <p className="eyebrow">Jev field test · daily challenge</p>
          <h1 id="game-title">Rules Are Lava</h1>
          <p className="lede">A survival writing game refereed by Jev.</p>
        </header>

        {phase === 'ready' || (phase === 'submitting' && !run) ? (
          <div className="ready-panel">
            <p className="briefing">Keep writing while the rules stack up. Break one, lose a life.</p>
            <button className="button button-primary" disabled={!board || phase === 'submitting'} onClick={start}>
              {phase === 'submitting' ? 'Lighting the fuse…' : "Play today's challenge"}
            </button>
            {board ? (
              <p className="daily-teaser">
                <span>{`Today's best: ${board.topScore} rounds`}</span>
                <span aria-hidden="true"> · </span>
                <Countdown deadlineAt={board.resetAt} reset />
              </p>
            ) : <p className="daily-teaser">Loading today&apos;s challenge…</p>}
            <details className="jev-note">
              <summary>How Jev judges</summary>
              <p>Exact constraints run in code. Meaning-based constraints use Jev&apos;s typed yes/no probabilities, shown after every answer.</p>
            </details>
          </div>
        ) : null}

        {run && phase !== 'ready' ? (
          <div className="play-panel">
            <div className="run-bar" aria-live="polite">
              <span>{run.score} survived</span>
              <span className="critter">{run.critterName}</span>
              <span>{run.lives} {run.lives === 1 ? 'life' : 'lives'}</span>
            </div>

            {phase === 'gameover' ? (
              <div className="gameover-panel">
                <span className="utility-label">Final signal</span>
                <h2>Run melted</h2>
                <p className="final-score"><strong>{run.score}</strong> rounds survived</p>
                {newPersonalBest ? <p className="personal-best">New personal best</p> : null}
                {verdicts.length ? <VerdictList verdicts={verdicts} /> : null}
                <div className="gameover-actions">
                  <button className="button button-primary" onClick={playAgain}>Play again</button>
                  {siteUrl ? <ShareOnX score={run.score} failedRule={run.lastFailure} siteUrl={siteUrl} /> : null}
                </div>
                {board ? <Leaderboard top={board.top} player={board.player} resetAt={board.resetAt} /> : null}
                {process.env.NEXT_PUBLIC_REPOSITORY_URL ? (
                  <a className="repository-link" href={process.env.NEXT_PUBLIC_REPOSITORY_URL} target="_blank" rel="noopener noreferrer">View how Jev judges on GitHub</a>
                ) : null}
              </div>
            ) : (
              <>
                <div className="round-heading">
                  <div>
                    <span className="utility-label">Round {run.roundIndex + 1}</span>
                    <h2>Obey every live rule</h2>
                  </div>
                  {run.deadlineAt ? <div className="timer" aria-label="Time left"><Countdown deadlineAt={run.deadlineAt} onExpire={() => void submit('timeout')} /></div> : null}
                </div>
                <RuleStack rules={run.activeRules} />
                {phase === 'verdict' && verdicts.length ? <VerdictList verdicts={verdicts} /> : null}
                <form className="response-form" onSubmit={event => { event.preventDefault(); void submit('answer'); }}>
                  <label htmlFor="response">Your response</label>
                  <textarea
                    id="response"
                    value={draft}
                    maxLength={160}
                    rows={4}
                    disabled={phase === 'submitting'}
                    onChange={event => updateDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        void submit('answer');
                      }
                    }}
                  />
                  <div className="response-meta">
                    <span>{draft.length}/160 · Ctrl/⌘ + Enter</span>
                    <button className="button button-primary" disabled={phase === 'submitting' || !draft.trim()} type="submit">
                      {phase === 'submitting' ? 'Checking with Jev…' : 'Submit response'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        ) : null}
        {error ? <p className="error" role="status">{error}</p> : null}
      </section>
    </main>
  );
}
