import type { Metadata } from 'next';
import Link from 'next/link';
import { StartButton } from '@/components/StartButton';
import { copy, formatDuration } from '@/lib/copy';
import { getGameResult, getRanking, RANKING_SIZE } from '@/lib/game-service';
import { StorageError } from '@/lib/game-store';
import { TOTAL_QUESTIONS } from '@/lib/scoring';
import type { RankingEntryPayload } from '@/types/api';

export const metadata: Metadata = { title: copy.meta.ranking };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Top 20, rendered on the server on every request (reading searchParams keeps
 * it dynamic, so it is never a stale build-time snapshot). `?partida=<id>`
 * highlights the game the player just saved.
 */
export default async function RankingPage({ searchParams }: PageProps<'/ranking'>) {
  const { partida } = await searchParams;
  const highlightGameId = typeof partida === 'string' && UUID.test(partida) ? partida : undefined;

  let entries: RankingEntryPayload[];
  try {
    ({ entries } = await getRanking({ highlightGameId }));
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    console.error(error.message);
    return (
      <div className="m-auto flex flex-col items-start gap-4">
        <h1 className="font-mono text-2xl font-bold">{copy.ranking.title}</h1>
        <p role="alert" className="text-danger">
          {copy.ranking.unavailable}
        </p>
        <Link
          href="/ranking"
          className="rounded-lg bg-brand px-6 py-3 font-semibold text-brand-contrast hover:bg-brand-hover"
        >
          {copy.ranking.retry}
        </Link>
      </div>
    );
  }

  // The player's game may be saved but outside the top 20.
  const outsideTop =
    highlightGameId && !entries.some((entry) => entry.isYou)
      ? await getGameResult(highlightGameId)
      : null;
  const yourRank = outsideTop?.status === 'finished' ? outsideTop.saved?.rank : undefined;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-mono text-3xl font-bold">{copy.ranking.title}</h1>
        <p className="text-muted">{copy.ranking.intro(RANKING_SIZE)}</p>
      </header>

      {entries.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-surface p-6">
          <p>{copy.ranking.empty}</p>
          <StartButton label={copy.ranking.play} />
        </div>
      ) : (
        <RankingTable entries={entries} />
      )}

      {yourRank && <p className="font-semibold text-brand">{copy.ranking.yourRank(yourRank)}</p>}

      <p className="text-sm text-muted">{copy.ranking.tieBreak}</p>
    </div>
  );
}

function RankingTable({ entries }: { entries: RankingEntryPayload[] }) {
  const { columns } = copy.ranking;
  return (
    <table className="w-full border-separate border-spacing-y-2 text-left">
      <caption className="sr-only">{copy.ranking.title}</caption>
      <thead className="text-sm text-muted">
        <tr>
          <th scope="col" className="px-3 font-normal">
            <span aria-hidden="true">#</span>
            <span className="sr-only">{columns.rank}</span>
          </th>
          <th scope="col" className="px-3 font-normal">
            {columns.nickname}
          </th>
          <th scope="col" className="px-3 text-right font-normal">
            {columns.score}
          </th>
          <th scope="col" className="hidden px-3 text-right font-normal sm:table-cell">
            {columns.correct}
          </th>
          <th scope="col" className="hidden px-3 text-right font-normal sm:table-cell">
            {columns.time}
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const cell = entry.isYou ? 'bg-surface-raised' : 'bg-surface';
          return (
            <tr key={entry.rank} aria-current={entry.isYou ? 'true' : undefined}>
              <td
                className={`rounded-l-lg px-3 py-3 font-mono font-bold ${cell} ${
                  entry.rank <= 3 ? 'text-brand' : 'text-muted'
                } ${entry.isYou ? 'border-y-2 border-l-2 border-brand' : ''}`}
              >
                {entry.rank}
              </td>
              <td className={`px-3 py-3 ${cell} ${entry.isYou ? 'border-y-2 border-brand' : ''}`}>
                <span className="font-mono break-all">{entry.nickname}</span>
                {entry.isYou && (
                  <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-brand-contrast">
                    {copy.ranking.you}
                  </span>
                )}
                {/* On narrow screens the last two columns move under the name. */}
                <span className="block text-sm text-muted sm:hidden">
                  {entry.correctCount}/{TOTAL_QUESTIONS} · {formatDuration(entry.durationMs)}
                </span>
              </td>
              <td
                className={`px-3 py-3 text-right font-mono font-bold ${cell} ${
                  entry.isYou ? 'border-y-2 border-brand max-sm:rounded-r-lg max-sm:border-r-2' : ''
                } max-sm:rounded-r-lg`}
              >
                {entry.score}
              </td>
              <td
                className={`hidden px-3 py-3 text-right font-mono sm:table-cell ${cell} ${
                  entry.isYou ? 'border-y-2 border-brand' : ''
                }`}
              >
                {entry.correctCount}/{TOTAL_QUESTIONS}
              </td>
              <td
                className={`hidden rounded-r-lg px-3 py-3 text-right font-mono sm:table-cell ${cell} ${
                  entry.isYou ? 'border-y-2 border-r-2 border-brand' : ''
                }`}
              >
                {formatDuration(entry.durationMs)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
