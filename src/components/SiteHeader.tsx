'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { copy } from '@/lib/copy';

/** Links have padding so the tap target is at least 24×24 px (WCAG 2.5.8). */
export function SiteHeader() {
  const pathname = usePathname();
  const current = (href: string) => (pathname === href ? 'page' : undefined);

  return (
    <header className="border-b border-border">
      <nav
        aria-label={copy.nav.label}
        className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-2 py-1"
      >
        <Link
          href="/"
          aria-current={current('/')}
          className="rounded-md px-2 py-2 font-mono text-sm font-semibold text-brand hover:text-brand-hover"
        >
          {'>'} {copy.nav.home}
        </Link>
        <Link
          href="/ranking"
          aria-current={current('/ranking')}
          className="rounded-md px-2 py-2 font-mono text-sm text-muted hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:underline-offset-4"
        >
          {copy.nav.ranking}
        </Link>
      </nav>
    </header>
  );
}
