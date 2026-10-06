'use client';

import { useEffect, useRef } from 'react';
import { ArrowIcon, CheckIcon, ClockIcon, CrossIcon } from '@/components/icons';
import { copy } from '@/lib/copy';
import type { AnswerResult } from '@/types/api';

type Props = {
  result: AnswerResult;
  onContinue: () => void;
};

/**
 * Shown after each answer. Wrong answers and timeouts always show the correct
 * answer and the explanation (PRD 5.4); on a right answer the explanation is
 * collapsible. There is no auto-advance, so everyone gets time to read.
 */
export function FeedbackPanel({ result, onContinue }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  const { Icon, title, tone } = result.correct
    ? { Icon: CheckIcon, title: copy.feedback.correct, tone: 'text-success border-success' }
    : result.timedOut
      ? { Icon: ClockIcon, title: copy.feedback.timeout, tone: 'text-danger border-danger' }
      : { Icon: CrossIcon, title: copy.feedback.wrong, tone: 'text-danger border-danger' };

  const explanation = (
    <>
      <p>{result.explanation}</p>
      {result.docUrl && (
        <a
          href={result.docUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-brand underline underline-offset-4 hover:text-brand-hover"
        >
          {copy.feedback.docLink}
        </a>
      )}
    </>
  );

  return (
    <section className={`flex flex-col gap-4 rounded-xl border-2 bg-surface p-5 ${tone}`}>
      <div role="status" className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-xl font-bold">
          <Icon className="size-6" />
          {title}
          {result.correct && (
            <span className="ml-auto font-mono text-base">
              {copy.feedback.points(result.points)}
            </span>
          )}
        </p>
        {!result.correct && (
          <p className="font-semibold text-foreground">
            {copy.feedback.correctAnswerWas(result.correctAnswer)}
          </p>
        )}
      </div>

      <div className="text-foreground">
        {result.correct ? (
          <details>
            <summary className="cursor-pointer text-muted hover:text-foreground">
              {copy.feedback.showExplanation}
            </summary>
            <div className="mt-2">{explanation}</div>
          </details>
        ) : (
          explanation
        )}
      </div>

      <button
        ref={buttonRef}
        type="button"
        onClick={onContinue}
        className="flex items-center justify-center gap-2 self-end rounded-lg bg-brand px-6 py-3 font-semibold text-brand-contrast transition-colors hover:bg-brand-hover"
      >
        {result.hasNext ? copy.feedback.next : copy.feedback.seeResult}
        <ArrowIcon />
      </button>
    </section>
  );
}
