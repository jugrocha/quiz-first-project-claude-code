# PRD — Quiz "Claude Code: Verdadeiro ou Falso"

> Documento destinado ao Claude Code para construir o projeto. Leia inteiro antes de começar e siga a seção 13 (Plano de implementação). Versão 2 — consolida as decisões do brainstorm.

## 1. Visão geral

Aplicação web em PT-BR com quiz **exclusivamente verdadeiro ou falso** sobre o Claude Code. Cada partida tem **15 perguntas com dificuldade progressiva** (Iniciante → Intermediário → Avançado), **timer de 15 segundos por pergunta**, pontuação com bônus de velocidade e **ranking global**. O jogador só informa um **nickname ao final da partida, se quiser salvar** o resultado no ranking.

| Item                    | Decisão                                          |
| ----------------------- | ------------------------------------------------ |
| Tipo de projeto         | Portfólio / estudo                               |
| Stack                   | Next.js (App Router) + TypeScript + Tailwind CSS |
| Formato de pergunta     | Apenas verdadeiro ou falso                       |
| Banco de perguntas      | 30–50 perguntas em JSON local (no repositório)   |
| Persistência do ranking | Supabase (Postgres)                              |
| Deploy                  | Vercel (app) + Supabase (banco)                  |
| Identidade visual       | Dark mode com laranja Anthropic                  |
| Idioma                  | PT-BR                                            |

## 2. Objetivos

**Negócio**

1. Demonstrar em portfólio um produto completo (front, API, banco, deploy).
2. Ensinar conceitos do Claude Code de forma leve, do nível de negócio ao avançado.
3. Servir como projeto de estudo de desenvolvimento assistido por Claude Code.

**Métricas de sucesso (v1)**

- Fluxo completo (home → 15 perguntas → resultado → salvar nickname → ranking) funcionando em produção.
- Tempo da home até a primeira pergunta < 15 s.
- Lighthouse ≥ 90 em Performance, Acessibilidade e Boas práticas (mobile).
- 0 respostas corretas expostas ao cliente antes de responder.

## 3. Público-alvo

| Persona          | Necessidade                                                                       |
| ---------------- | --------------------------------------------------------------------------------- |
| Gestor / Negócio | Entender o que é o Claude Code, para que serve, limites e segurança em alto nível |
| Dev iniciante    | Comandos básicos, `CLAUDE.md`, permissões                                         |
| Dev avançado     | Hooks, subagents, MCP, skills, headless, Claude API/SDK                           |

## 4. Escopo

### Dentro da v1

- Home com apresentação e botão "Jogar" (sem login, sem escolha de nível).
- Partida única de **15 perguntas** com dificuldade progressiva.
- **Timer de 15 s** por pergunta; estouro do tempo conta como erro.
- Pontuação com pontos por dificuldade e bônus de velocidade.
- **Em caso de erro (ou timeout):** mostrar a resposta correta e a explicação.
- Tela de resultado com pontuação, acertos, classificação e revisão dos erros.
- **Opção de salvar no ranking informando nickname** ao final da partida.
- Ranking global (top 20) e página de ranking.
- Botão de compartilhar resultado.
- Responsivo (mobile-first), acessível, tema escuro laranja.

### Fora da v1 (backlog)

- Login/contas, painel admin, i18n EN, multiplayer, escolha manual de nível, geração de perguntas por IA.

## 5. Estrutura da partida e mecânicas

### 5.1 Composição da partida (15 perguntas)

| Perguntas | Dificuldade   | Público de referência               |
| --------- | ------------- | ----------------------------------- |
| 1–5       | Iniciante     | Negócio / primeiros passos          |
| 6–10      | Intermediário | Uso diário e produtividade          |
| 11–15     | Avançado      | Automação, extensibilidade, API/SDK |

- As 5 perguntas de cada faixa são **sorteadas** do pool do respectivo nível, sem repetição na partida, **balanceando categorias** sempre que possível (não repetir a mesma categoria mais de 2× por faixa) e ~50% V / ~50% F por partida quando possível.
- A ordem dentro de cada faixa é embaralhada; a ordem entre faixas é fixa (progressão).

### 5.2 Timer

- **15 segundos** por pergunta, com barra/contagem regressiva visível e sinal acessível (`aria-live` discreto aos 5 s).
- O timer começa quando a pergunta é **exibida** e pausa durante o feedback.
- **Autoridade no servidor:** o servidor registra `question_shown_at`; resposta chegando após 15 s + tolerância de 2 s (latência) é tratada como **timeout** (erro, 0 pontos). O timer do cliente é apenas visual.
- Timeout: cliente chama a API de resposta com `answer: null` ao zerar.

### 5.3 Pontuação (constantes em `lib/scoring.ts`)

- Pontos base por acerto: Iniciante **10**, Intermediário **15**, Avançado **20**.
- **Bônus de velocidade:** `floor(base × 0.5 × segundosRestantes / 15)`.
- Erro ou timeout: **0**. Sem penalidade negativa.
- Pontuação máxima teórica: 5×15 + 5×22 + 5×30 = **335**.
- Desempate no ranking: maior pontuação, depois menor tempo total, depois data mais antiga.

### 5.4 Feedback por pergunta

- **Acerto:** confirmação curta + pontos ganhos (explicação opcional/recolhível).
- **Erro ou timeout:** destaque da **resposta correta** + **explicação** + link `docUrl` quando existir. Botão "Próxima" (sem avanço automático no erro para permitir leitura).
- Cores + ícones (não depender só de cor).

### 5.5 Classificação final (acertos em 15)

- 0–5: **Curioso** · 6–9: **Praticante** · 10–12: **Especialista** · 13–14: **Mestre** · 15: **Lenda do Claude Code**

### 5.6 Salvar no ranking

- Ao final, o jogador vê o resultado **sem precisar de nickname**.
- Opção "Salvar no ranking": campo de nickname (3–20 caracteres, `[A-Za-z0-9_-]`, filtro básico de palavrões) + botão salvar. Pode pular.
- Nickname lembrado em `localStorage` para preencher automaticamente.
- Nickname **não é único nem autenticado** (identidade fraca, aceita no portfólio); cada partida salva é uma linha independente. Uma partida só pode ser salva uma vez.

## 6. Requisitos funcionais

| ID    | Requisito                                          | Critério de aceite                                                                 |
| ----- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| RF-01 | Iniciar partida sem login                          | Clique em "Jogar" cria a partida e exibe a pergunta 1                              |
| RF-02 | 15 perguntas com progressão 5/5/5                  | Níveis nas posições corretas; sem repetição                                        |
| RF-03 | Responder V/F                                      | Botões grandes; atalhos `V`/`F`; bloqueio após envio                               |
| RF-04 | Timer de 15 s                                      | Timeout = erro; servidor rejeita respostas tardias                                 |
| RF-05 | Feedback com resposta correta + explicação em erro | Sempre exibido em erro/timeout                                                     |
| RF-06 | Pontuação com bônus de velocidade                  | Calculada no servidor conforme 5.3                                                 |
| RF-07 | Resultado final                                    | Pontos, acertos/15, tempo total, classificação, revisão dos erros                  |
| RF-08 | Salvar no ranking com nickname (opcional)          | Validação; grava uma única vez por partida                                         |
| RF-09 | Ranking top 20                                     | Ordenação conforme 5.3; destaca a linha do jogador após salvar                     |
| RF-10 | Compartilhar                                       | Copia `Fiz X pts no quiz Claude Code (Y/15) 🧡 <url>`; Web Share API se disponível |
| RF-11 | Jogar novamente                                    | Nova partida sem recarregar; prioriza perguntas não vistas na sessão               |

## 7. Requisitos não funcionais

- **Performance:** LCP < 2,5 s; Server Components por padrão; client components só onde há interação (pergunta/timer).
- **Acessibilidade (WCAG AA):** teclado completo, `aria-live` para feedback, contraste do laranja sobre fundo escuro validado, `prefers-reduced-motion`.
- **Segurança/anti-fraude:** ver seção 8.
- **Privacidade:** não coletar e-mail nem dados pessoais; apenas nickname voluntário.
- **Confiabilidade:** se o Supabase falhar, a partida ainda funciona (estado em memória/servidor stateless assinado — ver 8.3); salvar mostra erro com retry.
- **Qualidade:** TypeScript estrito, ESLint, Prettier, testes nas regras de negócio.

## 8. Arquitetura técnica

```
Browser (Next.js client)
   │ fetch
   ▼
Route Handlers /api/* (Vercel) ── supabase-js (service role, só servidor) ──▶ Supabase Postgres
   │
   └─ src/data/questions.json (bundle do servidor, com gabarito)
```

### 8.1 Decisões-chave

1. **Perguntas em JSON local**, importadas somente no servidor (`import 'server-only'`). O cliente **nunca** recebe `answer`/`explanation` antes de responder.
2. **Validação e pontuação no servidor** via `/api/answer`. O cliente jamais envia pontuação.
3. **Estado da partida:** persistir a partida em `games` no Supabase (perguntas sorteadas, respostas, timestamps). Isso permite o controle de tempo no servidor e impede forjar scores.
4. **Supabase só no servidor:** `SUPABASE_SERVICE_ROLE_KEY` como variável da Vercel, nunca `NEXT_PUBLIC_`. RLS ativado sem policies públicas.
5. **Rate limiting** básico nos endpoints de escrita (por IP; opção simples via tabela/contador ou Upstash/Vercel KV).
6. **Supabase "local e gratuito":** desenvolvimento local com **Supabase CLI** (`supabase start`, requer Docker) e migrações em `supabase/migrations`; produção em projeto **Supabase Cloud (plano Free)**. A Vercel não alcança o Supabase local, então produção usa o projeto cloud.

### 8.2 Fluxo de uma partida

1. `POST /api/games` → sorteia 15 perguntas (5/5/5), grava a partida, devolve `gameId` e a **primeira** pergunta (sem gabarito). O servidor grava `question_shown_at`.
2. `POST /api/games/{id}/answer` `{questionId, answer: boolean | null}` → valida tempo, calcula pontos, devolve `{correct, correctAnswer?, explanation?, docUrl?, points, runningScore, next?}`; a próxima pergunta vem no mesmo payload (e registra seu `shown_at`). Gabarito/explicação só voltam **após** a resposta.
3. Após a 15ª: resposta inclui resumo (`score`, `correctCount`, `durationMs`, `classification`, `review`).
4. `POST /api/games/{id}/save` `{nickname}` → grava no ranking (uma vez).
5. `GET /api/ranking` → top 20.

### 8.3 Estrutura de pastas sugerida

```
/src
  /app
    page.tsx                    # home
    /play/page.tsx              # partida
    /result/[gameId]/page.tsx   # resultado + salvar nickname
    /ranking/page.tsx
    /api/games/route.ts
    /api/games/[id]/answer/route.ts
    /api/games/[id]/save/route.ts
    /api/ranking/route.ts
  /components                   # QuestionCard, TimerBar, FeedbackPanel, ScoreSummary, SaveScoreForm, RankingTable
  /data/questions.json
  /lib
    questions.ts                # carga, validação zod, sorteio 5/5/5
    scoring.ts                  # pontuação, bônus, classificação
    game.ts                     # regras de partida e tempo
    supabase.ts                 # client server-only
    nickname.ts                 # validação/sanitização
    copy.ts                     # todos os textos PT-BR
  /types
/supabase/migrations
/tests
```

## 9. Modelo de dados (Supabase / Postgres)

```sql
create table games (
  id uuid primary key default gen_random_uuid(),
  question_ids text[] not null,               -- 15 ids na ordem da partida
  answers jsonb not null default '[]',        -- [{questionId, answer, correct, points, shownAt, answeredAt, timedOut}]
  current_index int not null default 0,
  question_shown_at timestamptz,
  score int not null default 0,
  correct_count int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  nickname text check (nickname ~ '^[A-Za-z0-9_-]{3,20}$'),
  saved_at timestamptz                        -- preenchido ao salvar no ranking
);

create index games_ranking_idx
  on games (score desc, (finished_at - started_at), finished_at)
  where saved_at is not null;

alter table games enable row level security;
-- sem policies: acesso apenas via service role no servidor
```

Ranking = partidas com `saved_at is not null`. Rejeitar finalização/salvamento de partida não concluída ou já salva.

## 10. Contratos de API

| Rota                          | Body                                      | Resposta                                                                                                |
| ----------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `POST /api/games`             | —                                         | `{ gameId, index: 0, total: 15, question: {id, statement, level, category}, timeLimitMs: 15000 }`       |
| `POST /api/games/{id}/answer` | `{ questionId, answer: boolean \| null }` | `{ correct, correctAnswer, explanation, docUrl?, points, runningScore, next?: {...}, summary?: {...} }` |
| `POST /api/games/{id}/save`   | `{ nickname }`                            | `{ rank }`                                                                                              |
| `GET /api/ranking`            | —                                         | `{ entries: [{ rank, nickname, score, correctCount, durationMs }] }`                                    |

Validar tudo com **zod**; erros no formato `{ error: { code, message } }`. Cada pergunta respondida uma única vez; respostas fora da ordem são rejeitadas.

## 11. Conteúdo: banco de perguntas

### 11.1 Formato (`src/data/questions.json`)

```json
{
  "id": "fund-001",
  "level": "beginner",
  "category": "fundamentos",
  "statement": "O Claude Code só funciona dentro do terminal.",
  "answer": false,
  "explanation": "Além do terminal (CLI), o Claude Code também tem integrações com IDEs e outras superfícies.",
  "docUrl": "https://docs.claude.com/en/docs/claude-code/overview"
}
```

Validação zod no teste/build: IDs únicos, `level` ∈ {beginner, intermediate, advanced}, `category` ∈ lista abaixo, `answer` booleano, `explanation` obrigatória, afirmações auto-contidas (sem "todas as anteriores").

### 11.2 Categorias temáticas

1. `fundamentos` — Fundamentos do Claude Code (CLI): o que é, instalação, permissões, fluxo básico, comandos essenciais.
2. `features` — Features e Produtividade: `CLAUDE.md`, `/init`, `/clear`, `/compact`, Plan Mode, slash commands, atalhos, gerenciamento de contexto, retomar sessões.
3. `api-sdk` — Claude API / SDK: Anthropic API, Agent SDK, uso programático/headless, tool use, modelos e conceitos de tokens/custos.
4. `boas-praticas` — Boas práticas e casos de uso: revisão humana do código, segurança, prompts eficazes, testes, CI, quando usar/não usar, uso em times.

### 11.3 Meta de volume e distribuição

- **~40 perguntas** (mínimo 30, máximo 50), sendo **≥ 10 por nível** (ideal 14/13/13) para garantir variedade nas faixas de 5.
- Distribuir as 4 categorias em todos os níveis quando fizer sentido (Claude API/SDK tende a se concentrar em intermediário/avançado).
- ~50% verdadeiras / ~50% falsas no total e por nível.
- Nível **Iniciante** deve incluir perguntas de **negócio** (valor, limites, segurança, revisão humana), sem jargão técnico.

### 11.4 Perguntas semente (exemplos de estilo)

> ⚠️ **Verificar cada afirmação na documentação oficial (docs.claude.com) antes de publicar.** Produto evolui; não invente comportamento. Ao final, listar as perguntas com menor certeza para revisão humana.

| Nível         | Categoria     | Afirmação                                                                                            | Resp. |
| ------------- | ------------- | ---------------------------------------------------------------------------------------------------- | ----- |
| Iniciante     | fundamentos   | O Claude Code só funciona dentro do terminal e não tem integração com IDEs.                          | F     |
| Iniciante     | fundamentos   | O Claude Code pede permissão antes de executar certas ações, como rodar comandos ou editar arquivos. | V     |
| Iniciante     | boas-praticas | Usar o Claude Code elimina a necessidade de revisar o código gerado.                                 | F     |
| Intermediário | features      | O arquivo `CLAUDE.md` fornece contexto persistente sobre o projeto ao Claude.                        | V     |
| Intermediário | features      | O comando `/init` gera um `CLAUDE.md` inicial a partir da análise do projeto.                        | V     |
| Intermediário | features      | O Plan Mode permite que o Claude planeje sem alterar arquivos.                                       | V     |
| Intermediário | features      | O comando `/clear` mantém todo o histórico da conversa no contexto.                                  | F     |
| Avançado      | features      | Hooks executam comandos automaticamente em eventos do ciclo de vida do Claude Code.                  | V     |
| Avançado      | features      | Subagents compartilham exatamente a mesma janela de contexto da conversa principal.                  | F     |
| Avançado      | api-sdk       | O modo não interativo (`claude -p`) permite usar o Claude Code em scripts e pipelines.               | V     |
| Avançado      | features      | Servidores MCP só podem ser configurados globalmente, nunca por projeto.                             | F     |

## 12. UX / UI

- **Tema:** dark mode. Fundo quase preto (`#0F0F10`/`#141413`), superfícies em cinza-quente escuro, texto claro (`#FAF9F5`), **acento laranja Anthropic** (aprox. `#D97757` / variação `#CC785C`). Definir tokens no Tailwind (`theme.extend.colors`) e verificar contraste AA.
- **Tipografia:** mono (ex.: JetBrains Mono / Geist Mono) para títulos e elementos "terminal"; sans para texto corrido.
- **Telas:** Home → Pergunta (progresso "7/15", faixa de nível, pontuação, barra de timer) → Feedback → Resultado (+ salvar nickname) → Ranking.
- **Barra de timer:** laranja que muda para vermelho/alerta nos últimos 5 s; respeitar reduced-motion.
- **Botões V/F:** grandes, com ícone + texto, atalhos de teclado exibidos.
- **Estados:** carregando, erro de rede com retry, ranking vazio, nickname inválido, partida expirada.
- Todos os textos em `lib/copy.ts` (facilita i18n futuro).

## 13. Plano de implementação (ordem sugerida)

1. Scaffold: `create-next-app` (TS, Tailwind, App Router, ESLint), Prettier, Vitest; tokens de tema.
2. Tipos + schema zod + `questions.json` inicial (≥ 4 perguntas por nível) para destravar o fluxo.
3. `lib/scoring.ts`, `lib/questions.ts` (sorteio 5/5/5, balanceamento) e `lib/game.ts` com **testes unitários** (pontuação, bônus, timeout, classificação, validação do JSON).
4. Supabase CLI local (`supabase init`/`start`), migração SQL, `lib/supabase.ts` server-only, `.env.example`.
5. Route Handlers (games, answer, save, ranking) com zod e testes de erro (partida inexistente, resposta duplicada/tardia, salvar duas vezes).
6. UI: home, pergunta + timer, feedback, resultado, formulário de nickname.
7. Ranking e compartilhar.
8. Completar o banco até ~40 perguntas pesquisando a documentação oficial.
9. Acessibilidade, responsivo, revisão de textos e contraste.
10. Criar projeto Supabase Cloud (Free), aplicar migrações, configurar env vars na Vercel, deploy e smoke test.
11. README (setup local com Supabase CLI, env vars, decisões, limitações, prints).

## 14. Variáveis de ambiente

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=      # somente servidor, nunca NEXT_PUBLIC_
NEXT_PUBLIC_SITE_URL=           # para o texto de compartilhamento
```

Não commitar `.env*`; fornecer `.env.example` (local aponta para `http://127.0.0.1:54321`).

## 15. Testes e qualidade

- **Unitários (Vitest):** pontuação/bônus, sorteio 5/5/5 e balanceamento, classificação, validação de nickname, validação do JSON.
- **API:** timeout no servidor, resposta duplicada, ordem inválida, salvar duas vezes, gabarito ausente nos payloads de pergunta.
- **E2E (Playwright, opcional):** fluxo home → 15 perguntas → salvar → ranking.
- **CI:** lint + typecheck + testes (GitHub Actions).

## 16. Riscos e premissas

| Item                                                     | Tratamento                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| Nickname sem senha/unicidade permite se passar por outro | Aceito na v1; documentar                                             |
| Fraude de score / timer                                  | Pontuação e tempo no servidor; gabarito só após resposta; rate limit |
| Latência distorcendo o timer                             | Tolerância de 2 s no servidor                                        |
| Perguntas desatualizadas                                 | `docUrl`, revisão manual, data da última revisão no README           |
| Nicknames ofensivos                                      | Filtro básico + remoção manual via SQL                               |
| Pool pequeno reduz rejogabilidade                        | ≥ 10 perguntas por nível; priorizar não vistas na sessão             |

**Premissas adotadas (não confirmadas):** ranking top 20; bônus de velocidade de até 50% do valor base; limites de classificação em 5.5; sem painel admin; tolerância de latência de 2 s.

## 17. Definition of Done

- [ ] Fluxo completo funcionando em produção (Vercel + Supabase Cloud).
- [ ] 30–50 perguntas validadas, ≥ 10 por nível, ~50/50 V/F, cobrindo as 4 categorias.
- [ ] Partida de 15 perguntas com progressão 5/5/5 e timer de 15 s aplicado no servidor.
- [ ] Erros/timeouts exibem resposta correta e explicação.
- [ ] Nickname solicitado apenas ao final, opcionalmente.
- [ ] Nenhum gabarito nos payloads de pergunta (coberto por teste).
- [ ] Testes e CI verdes; acessível por teclado; responsivo em 360 px.
- [ ] README completo.
