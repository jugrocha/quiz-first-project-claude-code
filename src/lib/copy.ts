/**
 * All user-facing PT-BR strings live here (CLAUDE.md conventions), including
 * API error messages, since the UI shows them to the player as-is.
 */

const seconds = (n: number) => `${n} ${n === 1 ? 'segundo' : 'segundos'}`;

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes} min ${rest} s` : `${rest} s`;
}

export const copy = {
  meta: {
    title: 'Claude Code: Verdadeiro ou Falso',
    description:
      'Quiz de verdadeiro ou falso sobre o Claude Code: 15 perguntas, 15 segundos cada, do básico ao avançado.',
  },
  home: {
    eyebrow: '> quiz',
    title: 'Claude Code: Verdadeiro ou Falso',
    intro:
      'Teste o que você sabe sobre o Claude Code, do básico ao avançado. Sem cadastro: é só jogar.',
    rules: [
      '15 perguntas de verdadeiro ou falso, das mais fáceis às mais difíceis.',
      '15 segundos por pergunta. Responder rápido vale bônus.',
      'Errou? Você vê a resposta certa e a explicação.',
      'No final, salve seu resultado no ranking se quiser.',
    ],
    rulesTitle: 'Como funciona',
    play: 'Jogar',
    starting: 'Preparando a partida…',
  },
  levels: {
    beginner: 'Iniciante',
    intermediate: 'Intermediário',
    advanced: 'Avançado',
  },
  play: {
    loading: 'Carregando pergunta…',
    progress: (index: number, total: number) => `Pergunta ${index} de ${total}`,
    score: 'Pontos',
    statementLabel: 'Verdadeiro ou falso?',
    true: 'Verdadeiro',
    false: 'Falso',
    shortcutHint: 'Atalhos: V para verdadeiro, F para falso.',
    sending: 'Enviando resposta…',
    timerLabel: 'Tempo restante',
    secondsLeft: seconds,
    timerWarning: 'Restam 5 segundos.',
    retry: 'Tentar novamente',
    networkError: 'Não foi possível falar com o servidor. Verifique sua conexão.',
    expiredTitle: 'Partida não encontrada',
    expiredText: 'Essa partida expirou ou não existe mais.',
    newGame: 'Nova partida',
  },
  feedback: {
    correct: 'Resposta certa!',
    wrong: 'Resposta errada.',
    timeout: 'Tempo esgotado.',
    points: (n: number) => `+${n} pontos`,
    correctAnswerWas: (answer: boolean) =>
      `A resposta certa é: ${answer ? 'Verdadeiro' : 'Falso'}.`,
    showExplanation: 'Ver explicação',
    docLink: 'Ler na documentação',
    next: 'Próxima pergunta',
    seeResult: 'Ver resultado',
  },
  result: {
    title: 'Resultado',
    score: 'Pontuação',
    correct: 'Acertos',
    correctOf: (n: number, total: number) => `${n} de ${total}`,
    time: 'Tempo total',
    classification: 'Classificação',
    reviewTitle: 'Revisão dos erros',
    reviewEmpty: 'Nenhum erro. Partida perfeita!',
    yourAnswer: 'Sua resposta',
    noAnswer: 'Sem resposta (tempo esgotado)',
    correctAnswer: 'Resposta certa',
    answer: (value: boolean) => (value ? 'Verdadeiro' : 'Falso'),
    playAgain: 'Jogar novamente',
    inProgressTitle: 'Partida em andamento',
    inProgressText: 'Essa partida ainda não terminou.',
    continueGame: 'Continuar partida',
  },
  save: {
    title: 'Salvar no ranking',
    intro: 'Opcional. Escolha um nickname para aparecer no ranking.',
    label: 'Nickname',
    hint: 'De 3 a 20 caracteres: letras, números, _ ou -.',
    submit: 'Salvar',
    saving: 'Salvando…',
    saved: (nickname: string, rank: number) =>
      `Salvo como ${nickname}. Você está em #${rank} no ranking.`,
    seeRanking: 'Ver ranking',
  },
  nav: {
    home: 'Início',
    ranking: 'Ranking',
    label: 'Navegação principal',
  },
  ranking: {
    title: 'Ranking',
    intro: (size: number) => `As ${size} melhores partidas salvas.`,
    tieBreak: 'Empate: vence quem terminou em menos tempo, depois quem jogou primeiro.',
    empty: 'Ninguém salvou uma partida ainda. Que tal ser o primeiro?',
    unavailable: 'Não foi possível carregar o ranking agora.',
    retry: 'Tentar novamente',
    play: 'Jogar',
    columns: {
      rank: 'Posição',
      nickname: 'Nickname',
      score: 'Pontos',
      correct: 'Acertos',
      time: 'Tempo',
    },
    you: 'você',
    yourRank: (rank: number) => `Sua partida está em #${rank}.`,
  },
  share: {
    button: 'Compartilhar resultado',
    copied: 'Texto copiado! Agora é só colar onde quiser.',
    failed: 'Não foi possível copiar. Selecione e copie o texto abaixo:',
    text: (score: number, correct: number, total: number, url: string) =>
      `Fiz ${score} pts no quiz Claude Code (${correct}/${total}) 🧡 ${url}`,
  },
  errors: {
    INVALID_BODY: 'Requisição inválida.',
    INVALID_GAME_ID: 'Identificador de partida inválido.',
    GAME_NOT_FOUND: 'Partida não encontrada ou expirada.',
    QUESTION_NOT_IN_GAME: 'Essa pergunta não faz parte da partida.',
    QUESTION_NOT_SHOWN: 'A pergunta ainda não foi exibida.',
    ALREADY_ANSWERED: 'Essa pergunta já foi respondida.',
    OUT_OF_ORDER: 'Responda as perguntas na ordem.',
    GAME_FINISHED: 'Essa partida já terminou.',
    GAME_NOT_FINISHED: 'Termine a partida antes de salvar no ranking.',
    ALREADY_SAVED: 'Essa partida já foi salva no ranking.',
    CONFLICT: 'Outra requisição alterou a partida ao mesmo tempo. Tente novamente.',
    INVALID_NICKNAME: 'Use de 3 a 20 caracteres: letras, números, _ ou -.',
    NICKNAME_NOT_ALLOWED: 'Esse nickname não é permitido. Escolha outro.',
    RATE_LIMITED: 'Muitas requisições. Aguarde um pouco e tente novamente.',
    STORAGE_UNAVAILABLE: 'Serviço temporariamente indisponível. Tente novamente.',
    INTERNAL: 'Erro inesperado. Tente novamente.',
  },
} as const;

export type ErrorCode = keyof typeof copy.errors;
