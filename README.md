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

## Conteúdo da TV

- Em **Dispositivos**, cadastre e pareie um painel. Use **Configurar painel** para ajustar serviços, cidade, letreiro, tempos e pesos das categorias.
- Em **Conteúdo**, cadastre avisos e dicas da unidade e envie o logotipo.
- Para notícias, configure `RSS_FEEDS` como JSON, por exemplo `[{"url":"https://exemplo.com/feed.xml","category":"cultura"}]`. Use fontes que autorizem a exibição comercial de manchetes e imagens.
- Para clima, configure `WEATHER_PROVIDER=weatherapi` e `WEATHER_API_KEY` com uma chave da [WeatherAPI.com](https://www.weatherapi.com/docs/). A disponibilidade da previsão depende do plano contratado.
