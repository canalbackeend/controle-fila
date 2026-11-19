# Beend Fila

Controle de filas com emissão de senhas, atendimento e acompanhamento em tempo real.

## Desenvolvimento

Use Node.js 22.13+, pnpm e Docker Compose.

```sh
cp .env.example .env
pnpm install
docker compose up -d --wait
pnpm --filter api prisma migrate deploy
pnpm --filter api prisma generate
pnpm --filter api seed
pnpm dev
```

Antes de executar o seed, preencha no arquivo `.env` a chave `SESSION_SECRET` (mínimo de 32 caracteres) e as senhas `DEMO_ADMIN_PASSWORD` e `SUPERADMIN_PASSWORD` (mínimo de 12 caracteres). Use valores aleatórios, por exemplo com `openssl rand -hex 32`.

O seed cria a conta `admin@demo.local` na empresa `demo` e a conta `superadmin@beend.local` na empresa `beend`. No ambiente demo, aplique um modelo na área Administração para cadastrar serviços e guichês.

A interface fica em http://localhost:5180 e a API responde em http://localhost:3000/health.

```sh
pnpm lint
pnpm typecheck
pnpm test
```

Com o banco local migrado, execute `RUN_DB_TESTS=1 pnpm test` para validar as operações com dois tenants temporários.
