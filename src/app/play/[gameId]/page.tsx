import type { Metadata } from 'next';
import { QuizGame } from '@/components/QuizGame';
import { copy } from '@/lib/copy';

export const metadata: Metadata = { title: copy.meta.play };

export default async function PlayPage({ params }: PageProps<'/play/[gameId]'>) {
  const { gameId } = await params;
  return <QuizGame gameId={gameId} />;
}
