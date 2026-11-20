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

O seed cria a conta `superadmin@beend.local` na empresa `beend`. Se `DEMO_ADMIN_PASSWORD` for preenchida, também cria a conta `admin@demo.local` na empresa `demo`. No ambiente demo, aplique um modelo na área Administração para cadastrar serviços e guichês.

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
- Os perfis de notícias incluem manchetes da Agência Câmara e da Agência Senado. Para acrescentar fontes, configure `RSS_FEEDS` como JSON, por exemplo `[{"url":"https://exemplo.com/feed.xml","category":"cultura"}]`. Use fontes que autorizem a exibição comercial de manchetes e imagens.
- Para clima, configure `WEATHER_PROVIDER=weatherapi` e `WEATHER_API_KEY` com uma chave da [WeatherAPI.com](https://www.weatherapi.com/docs/). A disponibilidade da previsão depende do plano contratado.

## Fluxo de teste

1. Entre como administrador da empresa demo e aplique um modelo em **Administração**.
2. Em **Dispositivos**, cadastre e pareie um totem e um painel de TV em abas diferentes. Na TV, selecione **Toque para iniciar**.
3. Em **Atendimento**, selecione um guichê e os serviços. Emita uma senha no totem e abra o link do QR Code em outra aba.
4. Chame, inicie, encaminhe ou finalize a senha. Observe a TV, a página de acompanhamento e os resultados em **Relatórios**.

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Consulte o [guia de deploy](docs/DEPLOY.md) para produção, backups e Coolify, e o [guia de dispositivos](docs/DISPOSITIVOS.md) para instalação em modo quiosque.
