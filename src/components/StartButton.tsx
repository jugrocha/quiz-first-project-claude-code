'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiRequestError, apiClient } from '@/lib/api-client';
import { copy } from '@/lib/copy';
import { readSeenQuestions } from '@/lib/seen-questions';

/** Creates a game and goes to it. Used on the home page and to play again. */
export function StartButton({ label = copy.home.play }: { label?: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const game = await apiClient.createGame(readSeenQuestions());
      router.push(`/play/${game.gameId}`);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : copy.errors.INTERNAL);
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={start}
        disabled={starting}
        className="rounded-lg bg-brand px-8 py-4 font-mono text-lg font-semibold text-brand-contrast transition-colors hover:bg-brand-hover disabled:cursor-wait disabled:opacity-70"
      >
        {starting ? copy.home.starting : label}
      </button>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
