# Plano de Desenvolvimento — Beend Fila (MVP)

Referência: `docs/PRD.md`. Regras do agente: `AGENTS.md`.

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Linguagem | TypeScript (back e front) | Um idioma só, tipos compartilhados |
| Monorepo | pnpm workspaces | Simples, rápido |
| API | Node.js 22 + Fastify | Leve e rápido |
| Tempo real | Socket.IO | Reconexão automática, salas por unidade/painel |
| Banco | PostgreSQL 16 + Prisma | Relacional, migrações fáceis |
| Validação | Zod (em `packages/shared`) | Mesmo schema no back e no front |
| Front | React + Vite + Tailwind | Uma app com rotas para cada tela |
| Jobs | node-cron dentro da API | Reset diário, busca de notícias/clima |
| Testes | Vitest + Playwright (E2E) | |
| Deploy | Docker Compose (Coolify) | Já usado pela Beend |

## Estrutura do repositório

```
/
├─ AGENTS.md
├─ docs/PRD.md, docs/PLANO.md
├─ apps/
│  ├─ api/          # Fastify + Socket.IO + Prisma + jobs
│  └─ web/          # React: /admin, /atendente, /painel, /totem, /t/:codigo
├─ packages/
│  └─ shared/       # tipos, schemas Zod, constantes, regra de prioridade
├─ docker-compose.yml
└─ .env.example
```

## Modelo de dados (resumo)

- `Tenant` (cliente Beend) → `Unit` (unidade; MVP usa 1)
- `User` (role: SUPERADMIN | ADMIN | ATTENDANT; tenantId)
- `Service` (nome, prefixo, prefixoPreferencial, callMode: TICKET|NAME, ratioNormal, ratioPreferential, stageOrder, ativo)
- `Counter` (guichê/mesa/consultório; nome, número)
- `CounterSession` (atendente + guichê + serviços atendidos + início/fim)
- `Ticket` (code, number, serviceId, priority: NORMAL|PREFERENTIAL|PRIORITY80, status, customerName?, publicToken, issuedAt, calledAt, startedAt, finishedAt, counterId?, targetCounterId?, businessDate)
- `TicketEvent` (ticketId, type, userId?, counterId?, fromServiceId?, toServiceId?, at)
- `Device` (type: PANEL|KIOSK, pairingCode, token, unitId, lastSeenAt)
- `PanelConfig` (deviceId, serviços exibidos, cardTypes, weights, cardSeconds, newsCategories, city, callDisplaySeconds)
- `Card` (type: TIP|NOTICE, imageUrl, title, text, tenantId? (null = global), validFrom/To, ativo)
- `NewsItem` (cache: sourceId, title, imageUrl, source, category, publishedAt)
- `WeatherCache` (city, payload, fetchedAt)
- `FeedSource` (url, categoria, ativo, global)
- `Template` (nicho, JSON com serviços/guichês/config)

Índice único: `(unitId, serviceId, businessDate, number)`. Numeração gerada em transação (`SELECT ... FOR UPDATE` ou contador por serviço/dia).

## Status da senha

```
WAITING → CALLED → IN_SERVICE → FINISHED
            │  ↺ RECALL         └→ FORWARDED → (WAITING em outro serviço)
            └→ NO_SHOW
WAITING → CANCELED
```

## Eventos Socket.IO

Salas: `unit:{id}`, `panel:{deviceId}`, `ticket:{publicToken}`.

| Evento | Direção | Payload |
|---|---|---|
| `ticket.issued` | servidor → unit | ticket resumido, tamanho das filas |
| `ticket.called` | servidor → unit/painéis/ticket | code, displayName, counter, isRecall |
| `ticket.updated` | servidor → ticket | status, pessoas à frente |
| `queue.stats` | servidor → unit | contagens por serviço |
| `panel.config` | servidor → panel | config atualizada |
| `panel.content` | servidor → panel | cards, notícias, clima |

---

## Marcos (milestones)

Cada marco termina com testes passando, app rodando via `docker compose up` e um commit. Use os prompts sugeridos no Codex, um por vez.

### M0 — Fundação
- Monorepo pnpm, TypeScript estrito, ESLint + Prettier.
- `apps/api` Fastify com `/health`; `apps/web` Vite + React + Tailwind com roteamento.
- Prisma + Postgres via Docker Compose; `.env.example`.
- Vitest configurado nos dois apps.
- **Pronto quando:** `pnpm dev` sobe tudo; `pnpm test` e `pnpm lint` passam.

> Prompt: "Leia AGENTS.md e docs/PLANO.md. Execute o marco M0 completo."

### M1 — Multi-tenant, autenticação e cadastros
- Schema Prisma completo (modelo acima) + seed (1 superadmin, 1 tenant demo).
- Login com cookie httpOnly; middleware que injeta `tenantId` e bloqueia acesso cruzado.
- CRUD admin: serviços, guichês, usuários.
- Templates Clínica, Cartório e Balcão aplicáveis a um tenant.
- **Pronto quando:** testes provam que um tenant não lê dados de outro.

### M2 — Motor de fila (núcleo)
- Emissão de senha com numeração diária segura em concorrência.
- Função pura `pickNextTicket()` em `packages/shared` com a regra de prioridade (intercalação + 80+ primeiro + fallback). **Cobertura de testes alta.**
- Ações: chamar próximo, rechamar, chamar específica, iniciar, encaminhar, finalizar, não compareceu, cancelar — todas gravando `TicketEvent`.
- Job de reset diário por fuso do tenant.
- **Pronto quando:** teste de concorrência (50 emissões simultâneas) sem números repetidos.

### M3 — Tempo real + Painel do atendente
- Socket.IO com autenticação (usuário e dispositivo).
- Tela `/atendente`: escolher guichê e serviços, botões de ação, contadores de fila em tempo real, atalhos de teclado (Espaço = chamar próximo, R = rechamar).
- **Pronto quando:** dois navegadores atendentes chamando ao mesmo tempo nunca pegam a mesma senha.

### M4 — Totem + impressão
- Pareamento de dispositivo por código (admin gera, totem digita uma vez, recebe token).
- Tela `/totem/:id`: botões grandes, escolha de serviço e tipo, confirmação, impressão.
- Layout de impressão 80 mm via CSS `@media print` (Chrome com `--kiosk-printing`), com QR Code.
- Emissão pelo balcão (dentro do painel do atendente).
- Rate limit na emissão; mensagem clara quando offline.
- **Pronto quando:** imprime em impressora térmica real em modo quiosque.

### M5 — Painel de TV
- Tela `/painel/:id` em tela cheia, layout do PRD (lateral, topo, carrossel, letreiro).
- Overlay de chamada: pausa carrossel, senha ampliada por N s, som "plim", fila de exibição para chamadas simultâneas.
- Desbloqueio de áudio: tela inicial "Toque para iniciar" (navegadores bloqueiam autoplay de som) + instrução de flag de quiosque `--autoplay-policy=no-user-gesture-required`.
- Service Worker: cache de imagens e do último conteúdo; reconexão automática; indicador offline discreto.
- **Pronto quando:** painel roda 24 h em teste sem vazamento de memória (verificar no DevTools).

### M6 — Conteúdo do carrossel
- Job de RSS (15 min): parse, extração de imagem (`enclosure`, `media:content` ou `og:image`), filtro por categoria, deduplicação.
- Job de clima (30 min) com interface `WeatherProvider` (trocar provedor sem mexer no resto).
- Admin: cadastro de cards (curiosidade, aviso), upload com redimensionamento (sharp), letreiro, configuração do painel (tipos, pesos, tempos, cidade, categorias).
- Algoritmo de sorteio ponderado dos cards respeitando os pesos e evitando repetição seguida.
- **Pronto quando:** painel exibe as 4 categorias de card conforme os pesos configurados.

### M7 — Acompanhamento no celular
- Página `/t/:publicToken`: senha, status, pessoas à frente, tempo real.
- Notificação do navegador ao faltarem N pessoas e ao ser chamado.
- **Pronto quando:** QR Code impresso abre a página e ela atualiza sozinha.

### M8 — Relatórios
- Endpoints agregados por período/serviço/atendente; tela com tabelas e gráficos simples; exportação CSV.

### M9 — Endurecimento e deploy
- E2E Playwright do fluxo completo: totem emite → atendente chama → TV exibe → celular atualiza → encaminha → finaliza.
- Logs estruturados (pino) sem dados pessoais; backup do Postgres.
- Dockerfiles de produção, `docker-compose.prod.yml`, guia de deploy no Coolify (`docs/DEPLOY.md`).
- Guia de instalação de TV e totem em modo quiosque (`docs/DISPOSITIVOS.md`).

## Ordem e estimativa

M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9.
M2 é o coração: não avance sem os testes de prioridade e concorrência sólidos.

## Fase 2 (não fazer agora)
Voz com áudios concatenados · WhatsApp/SMS · servidor local offline · vídeo mudo no carrossel · agendamento · multi-unidade · pesquisa de satisfação · cobrança.
