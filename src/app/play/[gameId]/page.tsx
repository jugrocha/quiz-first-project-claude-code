import { QuizGame } from '@/components/QuizGame';

export default async function PlayPage({ params }: PageProps<'/play/[gameId]'>) {
  const { gameId } = await params;
  return <QuizGame gameId={gameId} />;
}
