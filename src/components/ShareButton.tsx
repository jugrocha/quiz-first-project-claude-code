'use client';

import { useState } from 'react';
import { copy } from '@/lib/copy';

type Props = { score: number; correctCount: number; total: number };

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
}

/**
 * RF-10: native share sheet when the browser has one (mostly mobile),
 * otherwise copy the text to the clipboard, otherwise show it to copy by hand.
 */
export function ShareButton({ score, correctCount, total }: Props) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [text, setText] = useState('');

  async function share() {
    const message = copy.share.text(score, correctCount, total, siteUrl());
    setText(message);

    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch (error) {
        // The player closed the share sheet: nothing to do.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={share}
        className="rounded-lg border-2 border-brand px-6 py-3 font-semibold text-brand transition-colors hover:bg-brand hover:text-brand-contrast"
      >
        {copy.share.button}
      </button>
      <p role="status" className="text-sm text-success empty:hidden">
        {status === 'copied' ? copy.share.copied : ''}
      </p>
      {status === 'failed' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="share-text" className="text-sm text-muted">
            {copy.share.failed}
          </label>
          <textarea
            id="share-text"
            readOnly
            value={text}
            rows={2}
            onFocus={(event) => event.currentTarget.select()}
            className="rounded-lg border border-muted bg-surface-raised p-3 font-mono text-sm"
          />
        </div>
      )}
    </div>
  );
}
