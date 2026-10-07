'use client'; // Error boundaries must be Client Components

import Link from 'next/link';
import { useEffect } from 'react';
import { copy } from '@/lib/copy';

/** Fallback for unexpected errors while rendering a page, in PT-BR. */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="m-auto flex flex-col items-start gap-4">
      <h1 className="font-mono text-2xl font-bold">{copy.errorPage.errorTitle}</h1>
      <p className="text-muted">{copy.errorPage.errorText}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg bg-brand px-6 py-3 font-semibold text-brand-contrast hover:bg-brand-hover"
        >
          {copy.errorPage.retry}
        </button>
        <Link
          href="/"
          className="rounded-lg border-2 border-brand px-6 py-3 font-semibold text-brand hover:bg-brand hover:text-brand-contrast"
        >
          {copy.errorPage.home}
        </Link>
      </div>
    </div>
  );
}
