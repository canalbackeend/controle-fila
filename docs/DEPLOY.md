# Implantação do Beend Fila

## Docker Compose

O Compose de produção inclui PostgreSQL 16, API em Node.js 22, interface estática no Nginx e um serviço de backup. Apenas a interface recebe tráfego externo. As migrações são aplicadas antes de iniciar a API.

1. Configure as variáveis de `.env.example` na máquina ou no Coolify. Use valores próprios e aleatórios para `POSTGRES_PASSWORD` e `SESSION_SECRET`. Um valor hexadecimal de `openssl rand -hex 32` pode ser usado diretamente na URL do PostgreSQL.
2. Defina `APP_ORIGIN` como a origem HTTPS final, por exemplo `https://fila.suaempresa.com.br`. O mesmo endereço é usado pela TV, pelo totem e pelos celulares que leem os QR Codes.
3. Suba o Compose e confirme a resposta em `/api/health` no domínio escolhido.

```sh
docker compose -f docker-compose.prod.yml up -d --build --wait
docker compose -f docker-compose.prod.yml ps
```

Para criar a primeira conta, configure `SUPERADMIN_PASSWORD` e execute o seed uma vez. A conta é `superadmin@beend.local`, na empresa `beend`. Preencha `DEMO_ADMIN_PASSWORD` somente se quiser criar também a empresa demo.

```sh
docker compose -f docker-compose.prod.yml exec api pnpm --filter api seed
```

Entre com a conta superadmin, abra **Administração → Empresas** e cadastre a empresa com seu administrador. Com a conta da empresa, aplique um modelo e configure a unidade.

## Coolify

Crie um recurso **Docker Compose** apontando para o repositório e selecione `docker-compose.prod.yml`. No serviço `web`, configure o domínio com HTTPS para a porta interna 80. O banco e a API ficam na rede do Compose. Reserve um valor livre para `WEB_PORT` se houver publicação local de porta. A proxy do domínio deve encaminhar WebSocket em `/socket.io/` e anexar a cadeia real de `X-Forwarded-For`.

`TRUST_PROXY_HOPS` controla quantos proxies o Fastify considera ao identificar o IP para o limite de tentativas. O padrão 1 corresponde ao Nginx sozinho. Use 2 quando a proxy do Coolify for o único salto extra e o Nginx estiver acessível externamente apenas por ela. Ajuste conforme a topologia efetiva. Exclua caminhos públicos de senha e credenciais dos logs de acesso da proxy externa, caso ela esteja configurada para logar URLs completas.

Os volumes `postgres-data`, `uploads` e `backups` são persistentes. Use a mesma origem ao atualizar a aplicação para preservar sessões, pareamentos e QR Codes já impressos.

## Previsão do tempo

Configure `WEATHER_PROVIDER=weatherapi` e `WEATHER_API_KEY` nas variáveis de ambiente da API. O [plano gratuito da WeatherAPI.com](https://www.weatherapi.com/pricing) inclui três dias de previsão e até 100 mil consultas por mês para uso comercial. A TV credita a fonte.

Em **Dispositivos**, clique em **Configurar TV e clima** na linha da TV. Na seção **Previsão do tempo**, informe a cidade, selecione o estado e defina o **Peso do clima** acima de zero. Clique em **Salvar painel**. O servidor compartilha o cache entre painéis da mesma localização e atualiza os dados a cada 30 minutos. As configurações antigas mantêm a cidade salva até que um estado seja selecionado.

## Notícias da TV

Em **Dispositivos**, abra **Configurar TV e clima**. Na seção **Notícias da TV**, clique em um perfil para aplicá-lo imediatamente. Em **Configuração manual**, marque os temas desejados e clique em **Salvar notícias**. Deixe os temas desmarcados para exibir apenas as notícias cadastradas pela própria empresa em **Conteúdo → Adicionar conteúdo → Notícia personalizada**.

O servidor atualiza as manchetes a cada 15 minutos. As fontes incluídas são a [Agência Câmara](https://infograficos.camara.leg.br/manual-de-comunicacao/agencia-camara/) e a [Agência Senado](https://www12.senado.leg.br/assessoria-de-imprensa/noticias/politica-de-uso). O aplicativo agrupa as manchetes institucionais por tema e exibe o crédito sem importar fotos dessas fontes. Use `RSS_FEEDS` para acrescentar fontes licenciadas.

O [Wikimedia Commons](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/en) fornece fotos ilustrativas para as manchetes sem imagem. O servidor importa o catálogo na inicialização e tenta novamente uma vez ao dia para fotos pendentes. As miniaturas e os créditos ficam armazenados localmente. A TV exibe a foto ao fundo com autoria, licença e indicação de que é ilustrativa.

## Backup e restauração

O serviço `backup` grava um dump PostgreSQL e um arquivo de imagens na inicialização e a cada 24 horas. Por padrão, a retenção local é de 14 dias. Configure `BACKUP_INTERVAL_SECONDS` e `BACKUP_RETENTION_DAYS` conforme a operação.

```sh
docker compose -f docker-compose.prod.yml logs backup
docker compose -f docker-compose.prod.yml exec backup ls -lh /backups
docker compose -f docker-compose.prod.yml cp backup:/backups ./backup-beend
```

Para validar um dump, rode `pg_restore --list` antes de restaurá-lo. Teste a restauração em um banco novo e aplique o arquivo de imagens correspondente no volume de uploads da instalação de recuperação. Mantenha cópias do par de arquivos fora da VPS, com acesso restrito, pois podem conter dados operacionais e nomes ainda dentro do período de retenção.
