# AGENTS.md — Beend Fila

Você é o engenheiro responsável por construir o **Beend Fila**, um SaaS de controle de filas digital e convencional (totem, painel do atendente, painel de TV e acompanhamento pelo celular).

## Leia antes de qualquer tarefa
1. `docs/PRD.md` — o que construir e o que está fora do escopo.
2. `docs/PLANO.md` — stack, estrutura, modelo de dados, eventos e marcos (M0–M9).
3. Trabalhe **um marco por vez**, na ordem. Não adiante funcionalidades de marcos futuros nem da Fase 2.

## Stack (não troque sem pedir)
TypeScript estrito · pnpm workspaces · Node 22 + Fastify · Socket.IO · PostgreSQL + Prisma · Zod · React + Vite + Tailwind · Vitest · Playwright · Docker Compose.

## Comandos
```bash
pnpm install
pnpm dev              # sobe api e web
pnpm test             # testes unitários
pnpm test:e2e         # Playwright
pnpm lint && pnpm typecheck
pnpm --filter api prisma migrate dev
docker compose up -d  # Postgres local
```
Antes de considerar uma tarefa concluída: `pnpm lint`, `pnpm typecheck` e `pnpm test` devem passar. Se não passarem, corrija; não declare pronto.

## Regras invioláveis
- **Multi-tenant:** toda consulta ao banco filtra por `tenantId` (via helper/middleware, nunca manualmente esquecível). Todo endpoint novo precisa de teste provando isolamento entre tenants.
- **Regra de prioridade** fica em uma função pura em `packages/shared` (`pickNextTicket`) e é a única fonte da verdade. Não duplique essa lógica no front ou em outro lugar.
- **Numeração de senha** é gerada dentro de transação; nunca calcule "último número + 1" fora dela.
- **Toda mudança de status de senha** grava um `TicketEvent`.
- **APIs externas** (RSS, clima) são chamadas só pelo servidor, com cache. Dispositivos (TV/totem) nunca acessam APIs externas.
- **LGPD:** não logar nomes de clientes finais; chamada por nome exibe só primeiro nome + inicial do sobrenome; página pública `/t/:token` nunca mostra dados pessoais.
- **Segredos** só em variáveis de ambiente; mantenha `.env.example` atualizado; nunca comite `.env`.
- Valide toda entrada com Zod (schemas em `packages/shared`).

## Convenções
- Código, nomes de variáveis e commits em **inglês**; **textos da interface em português do Brasil**.
- Datas no banco em UTC; exibição no fuso do tenant. `businessDate` calculado pelo fuso do tenant.
- Componentes React pequenos; telas em `apps/web/src/pages/<area>`.
- Rotas da API em `apps/api/src/modules/<modulo>/` (routes, service, schema, tests).
- Commits no padrão Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`), um por unidade lógica de trabalho.
- Prefira simplicidade: sem bibliotecas novas sem necessidade clara; justifique no resumo quando adicionar uma.

## UI — telas e cuidados
- **Totem:** botões enormes (mín. 80 px de altura), alto contraste, no máximo 2 toques para tirar senha, volta à tela inicial após 15 s de inatividade.
- **Painel de TV:** 1920×1080, legível a 5 metros (senha atual ≥ 160 px), sem interação, conteúdo **mudo**; único som é o alerta de chamada. Deve rodar dias sem recarregar: limpe timers/listeners e evite vazamento de memória.
- **Atendente:** rápido de operar, atalhos de teclado, estado da fila sempre visível.
- **Celular:** mobile-first, leve, sem login.
- Dispositivos reconectam sozinhos e mostram indicador discreto quando offline.

## Testes obrigatórios
- `pickNextTicket`: intercalação, 80+ primeiro, fallback quando um tipo está vazio, encaminhamento preservando prioridade.
- Concorrência: emissões simultâneas sem número repetido; dois atendentes nunca chamam a mesma senha.
- Isolamento de tenant em cada módulo.
- Reset diário respeitando fuso.

## Ao terminar cada tarefa
Responda com um resumo curto: o que foi feito, arquivos principais, como testar manualmente e qualquer decisão ou pendência. Se algo no PRD for ambíguo, escolha a opção mais simples, registre em `docs/DECISOES.md` e siga.
