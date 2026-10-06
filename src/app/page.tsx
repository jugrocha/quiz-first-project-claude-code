import { StartButton } from '@/components/StartButton';
import { copy } from '@/lib/copy';

export default function Home() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-10">
      <header className="flex flex-col gap-4">
        <p className="font-mono text-sm text-brand">{copy.home.eyebrow}</p>
        <h1 className="font-mono text-3xl font-bold leading-tight sm:text-4xl">
          {copy.home.title}
        </h1>
        <p className="text-lg text-muted">{copy.home.intro}</p>
      </header>

      <section
        aria-labelledby="rules-title"
        className="rounded-xl border border-border bg-surface p-6"
      >
        <h2
          id="rules-title"
          className="mb-3 font-mono text-sm font-semibold uppercase tracking-wider text-muted"
        >
          {copy.home.rulesTitle}
        </h2>
        <ul className="flex flex-col gap-2">
          {copy.home.rules.map((rule) => (
            <li key={rule} className="flex gap-3">
              <span aria-hidden="true" className="font-mono text-brand">
                →
              </span>
              {rule}
            </li>
          ))}
        </ul>
      </section>

      <div className="sm:self-start">
        <StartButton />
      </div>
    </div>
  );
}
