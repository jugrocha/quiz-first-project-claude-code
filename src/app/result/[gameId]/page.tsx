import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckIcon, ClockIcon, CrossIcon } from '@/components/icons';
import { SavedNotice, SaveScoreForm } from '@/components/SaveScoreForm';
import { ShareButton } from '@/components/ShareButton';
import { StartButton } from '@/components/StartButton';
import { copy, formatDuration } from '@/lib/copy';
import { getGameResult } from '@/lib/game-service';
import type { GameSummary } from '@/types/api';

export const metadata: Metadata = { title: copy.meta.result };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ResultPage({ params }: PageProps<'/result/[gameId]'>) {
  const { gameId } = await params;
  const result = UUID.test(gameId)
    ? await getGameResult(gameId)
    : ({ status: 'not_found' } as const);

  if (result.status === 'not_found') {
    return (
      <Message title={copy.play.expiredTitle} text={copy.play.expiredText}>
        <StartButton label={copy.play.newGame} />
      </Message>
    );
  }

  if (result.status === 'in_progress') {
    return (
      <Message title={copy.result.inProgressTitle} text={copy.result.inProgressText}>
        <Link
          href={`/play/${gameId}`}
          className="rounded-lg bg-brand px-6 py-3 font-semibold text-brand-contrast hover:bg-brand-hover"
        >
          {copy.result.continueGame}
        </Link>
      </Message>
    );
  }

  const { summary, saved } = result;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-mono text-3xl font-bold">{copy.result.title}</h1>
      <Summary summary={summary} />

      {saved ? (
        <SavedNotice gameId={gameId} nickname={saved.nickname} rank={saved.rank} />
      ) : (
        <SaveScoreForm gameId={gameId} />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <StartButton label={copy.result.playAgain} />
        <ShareButton
          score={summary.score}
          correctCount={summary.correctCount}
          total={summary.total}
        />
      </div>

      <Review summary={summary} />
    </div>
  );
}

function Message(props: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="m-auto flex flex-col items-start gap-4">
      <h1 className="font-mono text-2xl font-bold">{props.title}</h1>
      <p className="text-muted">{props.text}</p>
      {props.children}
    </div>
  );
}

function Summary({ summary }: { summary: GameSummary }) {
  // At 360 px the two text values get a full row so they never overflow.
  const items = [
    { label: copy.result.score, value: String(summary.score), highlight: true },
    {
      label: copy.result.correct,
      value: copy.result.correctOf(summary.correctCount, summary.total),
    },
    { label: copy.result.time, value: formatDuration(summary.durationMs), wide: true },
    { label: copy.result.classification, value: summary.classification, wide: true },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-xl border border-border bg-surface p-4 ${item.wide ? 'max-sm:col-span-2' : ''}`}
        >
          <dt className="text-sm text-muted">{item.label}</dt>
          <dd
            className={`mt-1 font-mono text-2xl font-bold wrap-break-word ${item.highlight ? 'text-brand' : 'text-foreground'}`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Review({ summary }: { summary: GameSummary }) {
  return (
    <section aria-labelledby="review-title" className="flex flex-col gap-4">
      <h2 id="review-title" className="font-mono text-xl font-semibold">
        {copy.result.reviewTitle}
      </h2>
      {summary.review.length === 0 ? (
        <p className="flex items-center gap-2 text-success">
          <CheckIcon />
          {copy.result.reviewEmpty}
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {summary.review.map((item) => (
            <li
              key={item.questionId}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
            >
              <p className="text-lg">{item.statement}</p>
              <dl className="grid gap-1 text-sm sm:grid-cols-2">
                <div className="flex flex-wrap items-center gap-x-2 text-danger">
                  {item.timedOut ? <ClockIcon /> : <CrossIcon />}
                  <dt>{copy.result.yourAnswer}:</dt>
                  <dd className="font-semibold">
                    {item.yourAnswer === null
                      ? copy.result.noAnswer
                      : copy.result.answer(item.yourAnswer)}
                  </dd>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 text-success">
                  <CheckIcon />
                  <dt>{copy.result.correctAnswer}:</dt>
                  <dd className="font-semibold">{copy.result.answer(item.correctAnswer)}</dd>
                </div>
              </dl>
              <p className="text-muted">{item.explanation}</p>
              {item.docUrl && (
                <a
                  href={item.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start text-brand underline underline-offset-4 hover:text-brand-hover"
                >
                  {copy.feedback.docLink}
                  <span className="sr-only"> {copy.nav.newTab}</span>
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
