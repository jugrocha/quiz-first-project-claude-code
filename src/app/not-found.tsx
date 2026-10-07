import type { Metadata } from 'next';
import Link from 'next/link';
import { copy } from '@/lib/copy';

export const metadata: Metadata = { title: copy.meta.notFound };

export default function NotFound() {
  return (
    <div className="m-auto flex flex-col items-start gap-4">
      <h1 className="font-mono text-2xl font-bold">{copy.errorPage.notFoundTitle}</h1>
      <p className="text-muted">{copy.errorPage.notFoundText}</p>
      <Link
        href="/"
        className="rounded-lg bg-brand px-6 py-3 font-semibold text-brand-contrast hover:bg-brand-hover"
      >
        {copy.errorPage.home}
      </Link>
    </div>
  );
}
