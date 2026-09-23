import { act, render } from '@testing-library/react';
import { vi } from 'vitest';
import { Countdown } from './countdown';

it('fires one timeout even when the callback identity changes', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-23T12:00:00.000Z'));
  const expired = vi.fn();
  const deadlineAt = '2026-09-23T12:00:01.000Z';
  const { rerender } = render(<Countdown deadlineAt={deadlineAt} onExpire={() => expired()} />);
  rerender(<Countdown deadlineAt={deadlineAt} onExpire={() => expired()} />);
  act(() => vi.advanceTimersByTime(3_000));
  expect(expired).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});
