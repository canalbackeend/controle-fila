# Beend Fila

Controle de filas com emissão de senhas, atendimento e acompanhamento em tempo real.

## Desenvolvimento

Use Node.js 22.13+, pnpm e Docker Compose.

```sh
cp .env.example .env
pnpm install
docker compose up -d
pnpm dev
```

A interface fica em http://localhost:5180 e a API responde em http://localhost:3000/health.

```sh
pnpm lint
pnpm typecheck
pnpm test
```
