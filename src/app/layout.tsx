import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SiteHeader } from '@/components/SiteHeader';
import { copy } from '@/lib/copy';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: { default: copy.meta.title, template: `%s · ${copy.meta.title}` },
  description: copy.meta.description,
};

export const viewport: Viewport = {
  themeColor: '#0f0f10',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#conteudo"
          className="sr-only rounded-lg bg-brand px-4 py-2 font-semibold text-brand-contrast focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10"
        >
          {copy.nav.skipToContent}
        </a>
        <SiteHeader />
        <main
          id="conteudo"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 outline-none sm:py-12"
        >
          {children}
        </main>
      </body>
    </html>
  );
}
