import Link from 'next/link';
import { copy } from '@/lib/copy';

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <nav
        aria-label={copy.nav.label}
        className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-4 py-3"
      >
        <Link
          href="/"
          className="font-mono text-sm font-semibold text-brand hover:text-brand-hover"
        >
          {'>'} {copy.nav.home}
        </Link>
        <Link href="/ranking" className="font-mono text-sm text-muted hover:text-foreground">
          {copy.nav.ranking}
        </Link>
      </nav>
    </header>
  );
}
