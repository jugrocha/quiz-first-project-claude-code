'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FeedbackPanel } from '@/components/FeedbackPanel';
import { CheckIcon, CrossIcon } from '@/components/icons';
import { StartButton } from '@/components/StartButton';
import { TimerBar } from '@/components/TimerBar';
import { ApiRequestError, apiClient } from '@/lib/api-client';
import { copy } from '@/lib/copy';
import { rememberSeenQuestion } from '@/lib/seen-questions';
import type { AnswerResult, QuestionPayload } from '@/types/api';

/** What "Tentar novamente" repeats after a failed request. */
type Retry =
  | { type: 'load' }
  | { type: 'send'; payload: QuestionPayload; deadline: number; answer: boolean | null };

type Phase =
  | { kind: 'loading' }
  | { kind: 'question'; payload: QuestionPayload; deadline: number; sending: boolean }
  | { kind: 'feedback'; payload: QuestionPayload; result: AnswerResult }
  | { kind: 'error'; message: string; retry: Retry }
  | { kind: 'expired' };

/**
 * The game loop: show question (POST /next starts its timer) → answer →
 * feedback → next. Loading the current question through /next on mount also
 * makes a reload resume where the game was, with the timer still running.
 */
export function QuizGame({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [score, setScore] = useState(0);
  const statementRef = useRef<HTMLParagraphElement>(null);

  const goToResult = useCallback(() => router.push(`/result/${gameId}`), [router, gameId]);

  /**
   * Shows the right screen for a failed request. Returns true when the server
   * has already moved past this question (e.g. a retried answer that did
   * arrive), so the caller should reload the current question instead.
   */
  const fail = useCallback(
    (error: unknown, retry: Retry): boolean => {
      const code = error instanceof ApiRequestError ? error.code : 'INTERNAL';
      if (code === 'ALREADY_ANSWERED' || code === 'QUESTION_NOT_SHOWN') return true;
      if (code === 'GAME_FINISHED') {
        goToResult();
      } else if (code === 'GAME_NOT_FOUND' || code === 'INVALID_GAME_ID') {
        setPhase({ kind: 'expired' });
      } else {
        const message = error instanceof ApiRequestError ? error.message : copy.errors.INTERNAL;
        setPhase({ kind: 'error', message, retry });
      }
      return false;
    },
    [goToResult],
  );

  const showQuestion = useCallback((payload: QuestionPayload) => {
    rememberSeenQuestion(payload.question.id);
    setScore(payload.score);
    setPhase({
      kind: 'question',
      payload,
      deadline: performance.now() + payload.remainingMs,
      sending: false,
    });
  }, []);

  const loadCurrent = useCallback(async () => {
    try {
      showQuestion(await apiClient.next(gameId));
    } catch (error) {
      fail(error, { type: 'load' });
    }
  }, [gameId, fail, showQuestion]);

  const send = useCallback(
    async (payload: QuestionPayload, deadline: number, answer: boolean | null) => {
      setPhase({ kind: 'question', payload, deadline, sending: true });
      try {
        const result = await apiClient.answer(gameId, payload.question.id, answer);
        setScore(result.runningScore);
        setPhase({ kind: 'feedback', payload, result });
      } catch (error) {
        if (fail(error, { type: 'send', payload, deadline, answer })) {
          setPhase({ kind: 'loading' });
          void loadCurrent();
        }
      }
    },
    [gameId, fail, loadCurrent],
  );

  function retry(action: Retry) {
    if (action.type === 'send') {
      void send(action.payload, action.deadline, action.answer);
    } else {
      setPhase({ kind: 'loading' });
      void loadCurrent();
    }
  }

  const submit = useCallback(
    (answer: boolean | null) => {
      if (phase.kind !== 'question' || phase.sending) return;
      void send(phase.payload, phase.deadline, answer);
    },
    [phase, send],
  );

  // Load the current question on mount. /next is idempotent, so the double
  // mount in development only costs a duplicate request.
  useEffect(() => {
    let active = true;
    apiClient.next(gameId).then(
      (payload) => active && showQuestion(payload),
      (error) => active && fail(error, { type: 'load' }),
    );
    return () => {
      active = false;
    };
  }, [gameId, fail, showQuestion]);

  // V / F shortcuts while a question is open.
  useEffect(() => {
    if (phase.kind !== 'question' || phase.sending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key !== 'v' && key !== 'f') return;
      event.preventDefault();
      submit(key === 'v');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, submit]);

  // Move focus to each new question so screen readers read it.
  const questionId = phase.kind === 'question' ? phase.payload.question.id : null;
  useEffect(() => {
    if (questionId) statementRef.current?.focus();
  }, [questionId]);

  function onContinue(result: AnswerResult) {
    if (!result.hasNext) return goToResult();
    setPhase({ kind: 'loading' });
    void loadCurrent();
  }

  if (phase.kind === 'loading') {
    return (
      <p role="status" className="m-auto text-muted">
        {copy.play.loading}
      </p>
    );
  }

  if (phase.kind === 'expired') {
    return (
      <div className="m-auto flex flex-col items-start gap-4">
        <h1 className="font-mono text-2xl font-bold">{copy.play.expiredTitle}</h1>
        <p className="text-muted">{copy.play.expiredText}</p>
        <StartButton label={copy.play.newGame} />
      </div>
    );
  }

  if (phase.kind === 'error') {
    return (
      <div className="m-auto flex flex-col items-start gap-4">
        <p role="alert" className="text-danger">
          {phase.message}
        </p>
        <button
          type="button"
          onClick={() => retry(phase.retry)}
          className="rounded-lg bg-brand px-6 py-3 font-semibold text-brand-contrast hover:bg-brand-hover"
        >
          {copy.play.retry}
        </button>
      </div>
    );
  }

  const { payload } = phase;
  const answering = phase.kind === 'question';

  return (
    <div className="flex flex-col gap-6">
      {/* Mounted while the question is open, so the verdict is announced reliably. */}
      <p aria-live="polite" className="sr-only">
        {phase.kind === 'feedback' ? verdict(phase.result) : ''}
      </p>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-lg font-semibold">
            {copy.play.progress(payload.index + 1, payload.total)}
          </h1>
          <span className="rounded-full border border-brand px-3 py-0.5 text-sm text-brand">
            {copy.levels[payload.question.level]}
          </span>
        </div>
        <p className="font-mono">
          <span className="text-muted">{copy.play.score}: </span>
          <span className="font-semibold tabular-nums">{score}</span>
        </p>
      </header>

      <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
        <div
          className="h-full bg-muted"
          style={{ width: `${((payload.index + (answering ? 0 : 1)) / payload.total) * 100}%` }}
        />
      </div>

      {answering && (
        <TimerBar
          key={payload.question.id}
          deadline={phase.deadline}
          totalMs={payload.timeLimitMs}
          paused={phase.sending}
          onExpire={() => submit(null)}
        />
      )}

      <section className="rounded-xl border border-border bg-surface p-6">
        <p className="mb-2 text-sm text-muted">{copy.play.statementLabel}</p>
        <p
          ref={statementRef}
          tabIndex={-1}
          className="text-xl leading-relaxed outline-none sm:text-2xl"
        >
          {payload.question.statement}
        </p>
      </section>

      {answering ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <AnswerButton
              label={copy.play.true}
              shortcut="V"
              icon={<CheckIcon className="size-6" />}
              disabled={phase.sending}
              onClick={() => submit(true)}
            />
            <AnswerButton
              label={copy.play.false}
              shortcut="F"
              icon={<CrossIcon className="size-6" />}
              disabled={phase.sending}
              onClick={() => submit(false)}
            />
          </div>
          <p className="text-center text-sm text-muted" aria-live="polite">
            {phase.sending ? copy.play.sending : copy.play.shortcutHint}
          </p>
        </div>
      ) : (
        <FeedbackPanel
          key={payload.question.id}
          result={phase.result}
          onContinue={() => onContinue(phase.result)}
        />
      )}
    </div>
  );
}

function verdict(result: AnswerResult): string {
  if (result.correct) return `${copy.feedback.correct} ${copy.feedback.points(result.points)}`;
  const title = result.timedOut ? copy.feedback.timeout : copy.feedback.wrong;
  return `${title} ${copy.feedback.correctAnswerWas(result.correctAnswer)}`;
}

function AnswerButton(props: {
  label: string;
  shortcut: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-keyshortcuts={props.shortcut}
      className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border-2 border-border bg-surface-raised p-4 text-lg font-semibold transition-colors hover:border-brand hover:text-brand disabled:cursor-wait disabled:opacity-60"
    >
      {props.icon}
      {props.label}
      <kbd className="rounded border border-muted px-2 py-0.5 font-mono text-xs text-muted">
        {props.shortcut}
      </kbd>
    </button>
  );
}
