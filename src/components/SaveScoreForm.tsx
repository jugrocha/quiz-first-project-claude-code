'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ApiRequestError, apiClient } from '@/lib/api-client';
import { copy } from '@/lib/copy';
import { checkNickname } from '@/lib/nickname';

const STORAGE_KEY = 'quiz-nickname';

function readStoredNickname(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeNickname(nickname: string) {
  try {
    localStorage.setItem(STORAGE_KEY, nickname);
  } catch {
    // Private mode or storage disabled: remembering the nickname is optional.
  }
}

/** Optional "save to ranking" form shown at the end of a game (PRD 5.6). */
export function SaveScoreForm({ gameId }: { gameId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ nickname: string; rank: number } | null>(null);

  // Prefill after hydration; the server render can't see localStorage.
  useEffect(() => {
    const input = inputRef.current;
    if (input && !input.value) input.value = readStoredNickname();
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get('nickname') ?? '');
    const check = checkNickname(raw);
    if (!check.ok) {
      setError(
        check.reason === 'format' ? copy.errors.INVALID_NICKNAME : copy.errors.NICKNAME_NOT_ALLOWED,
      );
      inputRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { rank } = await apiClient.save(gameId, check.nickname);
      storeNickname(check.nickname);
      setSaved({ nickname: check.nickname, rank });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : copy.errors.INTERNAL);
      setSaving(false);
    }
  }

  if (saved) {
    return <SavedNotice gameId={gameId} nickname={saved.nickname} rank={saved.rank} />;
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="save-title"
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
    >
      <h2 id="save-title" className="font-mono text-lg font-semibold">
        {copy.save.title}
      </h2>
      <p className="text-muted">{copy.save.intro}</p>
      <label htmlFor="nickname" className="font-semibold">
        {copy.save.label}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          ref={inputRef}
          id="nickname"
          name="nickname"
          type="text"
          autoComplete="nickname"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          aria-invalid={error !== null}
          aria-describedby={error ? 'nickname-hint nickname-error' : 'nickname-hint'}
          className="flex-1 rounded-lg border border-muted bg-surface-raised px-4 py-3 font-mono text-foreground aria-invalid:border-danger"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-6 py-3 font-semibold text-brand-contrast transition-colors hover:bg-brand-hover disabled:cursor-wait disabled:opacity-70"
        >
          {saving ? copy.save.saving : copy.save.submit}
        </button>
      </div>
      <p id="nickname-hint" className="text-sm text-muted">
        {copy.save.hint}
      </p>
      {error && (
        <p id="nickname-error" role="alert" className="text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

/** Also rendered by the result page when the game was saved earlier. */
export function SavedNotice(props: { gameId: string; nickname: string; rank: number }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-success bg-surface p-5">
      <p role="status" className="text-success">
        {copy.save.saved(props.nickname, props.rank)}
      </p>
      <Link
        href={`/ranking?partida=${props.gameId}`}
        className="text-brand underline underline-offset-4 hover:text-brand-hover"
      >
        {copy.save.seeRanking}
      </Link>
    </div>
  );
}
