'use client';

import { useEffect, useRef, useState } from 'react';
import { copy } from '@/lib/copy';

const WARNING_MS = 5_000;

type Props = {
  /** performance.now() timestamp when time runs out. */
  deadline: number;
  totalMs: number;
  /** Stop counting (e.g. while the answer is being sent). */
  paused: boolean;
  onExpire: () => void;
};

/**
 * Visual countdown only: the server decides timeouts (CLAUDE.md "Timer").
 * Announces once, politely, when 5 seconds are left. With reduced motion the
 * bar steps once per second instead of shrinking smoothly.
 */
export function TimerBar({ deadline, totalMs, paused, onExpire }: Props) {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - performance.now()));
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (paused) return;
    let frame = 0;
    let expired = false;
    const tick = () => {
      const left = Math.max(0, deadline - performance.now());
      setRemaining(left);
      if (left === 0) {
        if (!expired) {
          expired = true;
          onExpireRef.current();
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [deadline, paused]);

  const seconds = Math.ceil(remaining / 1000);
  const warning = remaining <= WARNING_MS;
  const percent = (remaining / totalMs) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">{copy.play.timerLabel}</span>
        <span
          className={`font-mono font-semibold tabular-nums ${warning ? 'text-danger' : 'text-foreground'}`}
          aria-hidden="true"
        >
          {seconds}s
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={copy.play.timerLabel}
        aria-valuemin={0}
        aria-valuemax={Math.round(totalMs / 1000)}
        aria-valuenow={seconds}
        aria-valuetext={copy.play.secondsLeft(seconds)}
        className="h-3 overflow-hidden rounded-full bg-surface-raised"
      >
        <div
          className={`h-full rounded-full ${warning ? 'bg-danger' : 'bg-brand'} motion-reduce:hidden`}
          style={{ width: `${percent}%` }}
        />
        <div
          className={`hidden h-full rounded-full ${warning ? 'bg-danger' : 'bg-brand'} motion-reduce:block`}
          style={{ width: `${(seconds / (totalMs / 1000)) * 100}%` }}
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {warning && remaining > 0 ? copy.play.timerWarning : ''}
      </p>
    </div>
  );
}
