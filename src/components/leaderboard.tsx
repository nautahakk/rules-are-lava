'use client';

import { Countdown } from './countdown';

export type LeaderboardEntry = {
  rank: number;
  critterName: string;
  score: number;
  isPlayer: boolean;
};

function Row({ entry, player = false }: { entry: LeaderboardEntry; player?: boolean }) {
  return (
    <li className={player ? 'board-row board-player' : 'board-row'} aria-current={entry.isPlayer ? 'true' : undefined}>
      <span className="board-rank">{entry.rank}</span>
      <span>{entry.critterName}</span>
      {player ? <span className="you-label">Your best</span> : null}
      <strong>{entry.score}</strong>
    </li>
  );
}

export function Leaderboard({ top, player, resetAt }: {
  top: LeaderboardEntry[];
  player: (LeaderboardEntry & { isPlayer: true }) | null;
  resetAt: string;
}) {
  const showPlayer = player && !top.some(entry => entry.isPlayer);
  return (
    <section className="leaderboard" aria-labelledby="survivors-title">
      <div className="leaderboard-heading">
        <div>
          <span className="utility-label">Daily board</span>
          <h2 id="survivors-title">Today&apos;s Survivors</h2>
        </div>
        <Countdown deadlineAt={resetAt} reset />
      </div>
      {top.length ? <ol className="board-list">{top.slice(0, 10).map((entry, index) => <Row entry={entry} key={`${entry.critterName}-${index}`} />)}</ol>
        : <p className="empty-board">No finished runs yet. The first footprint could be yours.</p>}
      {showPlayer ? <ol className="board-list board-pinned" start={player.rank}><Row entry={player} player /></ol> : null}
    </section>
  );
}
