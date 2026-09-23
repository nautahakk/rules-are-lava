'use client';

import { useEffect, useRef, useState } from 'react';

function remainingSeconds(deadlineAt: string): number {
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000));
}

export function Countdown({ deadlineAt, onExpire, reset = false }: {
  deadlineAt: string;
  onExpire?: () => void;
  reset?: boolean;
}) {
  const [seconds, setSeconds] = useState(() => remainingSeconds(deadlineAt));
  const expired = useRef(false);
  const expire = useRef(onExpire);

  useEffect(() => { expire.current = onExpire; }, [onExpire]);

  useEffect(() => {
    expired.current = false;
    const update = () => {
      const next = remainingSeconds(deadlineAt);
      setSeconds(next);
      if (next === 0 && expire.current && !expired.current) {
        expired.current = true;
        expire.current();
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [deadlineAt]);

  if (!reset) return <span>{seconds}s</span>;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return <span>{hours > 0 ? `resets in ${hours}h ${minutes}m` : `resets in ${minutes}m`}</span>;
}
