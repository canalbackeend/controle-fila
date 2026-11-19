# PRD — Beend Fila (Controle de Fila Digital e Convencional)

Versão: 1.0 (MVP) · Data: 19/11/2026 · Dono: Cristiano (Beend)

## 1. Visão

Sistema SaaS de controle de filas para qualquer negócio com atendimento ao público (clínicas, recepção de hospitais, cartórios, correios, balcões em geral). Combina senha **convencional** (impressa no totem/balcão) e **digital** (acompanhamento no celular), com painel de TV atrativo e configurável.

Diferencial Beend: pacote completo **totem + fila + painel de TV** (e, futuramente, pesquisa de satisfação já existente nos totens Beend).

## 2. Objetivos do MVP

1. Emitir, chamar e finalizar senhas com prioridade legal correta.
2. Suportar fluxos de várias etapas (ex.: recepção → triagem → consultório).
3. Painel de TV mudo com carrossel de conteúdo e chamada de senha com alerta sonoro.
4. Implantar um cliente novo em menos de 30 minutos usando templates por nicho.
5. Ser vendável para vários clientes (multi-tenant) desde o primeiro dia.

### Métricas de sucesso
- Chamada aparece na TV em até 1 s após o clique do atendente.
- Painel de TV roda 7 dias sem intervenção manual.
- Implantação de cliente com template em até 30 min.

## 3. Perfis de usuário

| Perfil | Quem é | O que faz |
|---|---|---|
| Superadmin | Equipe Beend | Cria clientes (tenants), templates, conteúdos globais (curiosidades) |
| Admin do cliente | Gerente do local | Configura serviços, guichês, usuários, prioridades, painel e avisos |
| Atendente | Recepcionista, escrevente, médico | Chama, rechama, encaminha, finaliza senhas |
| Cliente final | Paciente, usuário do cartório | Tira senha, acompanha a fila, é chamado |

## 4. Requisitos funcionais

### RF01 — Emissão de senha
- Totem (tela touch, navegador em modo quiosque): cliente escolhe serviço e tipo (Normal / Preferencial / Prioridade 80+).
- Impressão em impressora térmica 80 mm com: nome do local, senha, serviço, data/hora, pessoas à frente e QR Code de acompanhamento.
- Balcão: atendente gera senha para o cliente, com opção de imprimir ou exibir o QR Code na tela.
- Formato da senha: `PREFIXO + número de 3 dígitos` (ex.: A001, P012). Prefixo definido por serviço/tipo.
- Numeração reinicia diariamente (horário configurável, padrão 00:00 no fuso do cliente).

### RF02 — Prioridades
- Tipos: Normal, Preferencial (Lei 10.048/2000), Prioridade especial 80+ (Estatuto da Pessoa Idosa).
- Regra de intercalação configurável por serviço (padrão: 1 preferencial a cada 2 normais).
- 80+ tem precedência sobre os demais preferenciais.
- Se não houver senha de um tipo, chama a do outro (nunca deixar guichê ocioso com gente esperando).

### RF03 — Fluxo de atendimento e encaminhamento
- Serviços podem ser organizados em etapas.
- Atendente pode **encaminhar** a senha para outro serviço/fila mantendo o mesmo código; a senha entra na nova fila preservando a prioridade e, opcionalmente, com destino a um guichê/profissional específico.
- Histórico completo de eventos da senha (emitida, chamada, rechamada, iniciada, encaminhada, finalizada, não compareceu).

### RF04 — Painel do atendente
- Login; seleção do guichê/mesa/consultório no início do turno.
- Seleção de quais serviços aquele guichê atende.
- Ações: **Chamar próximo**, **Rechamar**, **Iniciar atendimento**, **Encaminhar**, **Finalizar**, **Não compareceu**, **Chamar senha específica**.
- Visão das filas que atende (quantidade aguardando, tempo de espera da mais antiga).

### RF05 — Forma de chamada
- Configurável por serviço: por **senha** (padrão) ou por **nome**.
- Chamada por nome exibe apenas primeiro nome + inicial do sobrenome (ex.: "Maria S."), em conformidade com a LGPD. Nome é coletado no balcão, nunca obrigatório no totem.

### RF06 — Painel de TV
Layout em tela cheia (1920×1080, adaptável):
- **Lateral (≈30%)**: senha atual em destaque, guichê/destino, últimas 3–5 chamadas.
- **Topo**: logo do cliente, relógio, data, clima resumido.
- **Área principal (≈70%)**: carrossel de cards.
- **Rodapé**: letreiro rolante com avisos do cliente.

Carrossel — tipos de card:
| Tipo | Conteúdo | Origem |
|---|---|---|
| Notícia | Imagem + título + fonte | RSS (cache no servidor) |
| Clima | Ícone, temperatura atual, previsão do dia/semana | API de clima (cache no servidor) |
| Curiosidade/Dica | Imagem + texto curto | Cadastro Beend (global) ou do cliente |
| Aviso/Propaganda | Imagem enviada pelo cliente | Upload do cliente |

Configurações por painel: tipos ativos, proporção de exibição (ex.: 50% avisos, 30% notícias, 20% clima), tempo por card (padrão 10 s, 5–30 s), categorias de notícia (política e polícia bloqueadas por padrão), cidade do clima, serviços cujas chamadas aparecem nesse painel.

Comportamento de chamada:
1. Carrossel pausa.
2. Senha ocupa a tela ampliada por 5 s (configurável), piscando.
3. Toca alerta sonoro ("plim").
4. Volta ao layout normal e o carrossel continua.
- Chamadas simultâneas entram em fila de exibição (não se sobrepõem).
- **Conteúdo é mudo.** O único som é o alerta de chamada.

### RF07 — Acompanhamento no celular
- Página web pública acessada pelo QR Code (`/t/{codigo}`), sem login e sem app.
- Mostra senha, serviço, posição/pessoas à frente, status, e atualiza em tempo real.
- Notificação do navegador (quando permitido) ao faltarem N pessoas (padrão 3) e ao ser chamado.
- Expira ao fim do dia; não exibe dados pessoais.

### RF08 — Administração
- CRUD: unidades, serviços (prefixo, tipo de chamada, regras de prioridade, etapa), guichês, usuários e permissões, painéis, totens, cards e avisos.
- Templates por nicho que pré-criam serviços, prioridades e fluxo: **Clínica**, **Cartório**, **Balcão/Varejo**.
- Upload de logo e imagens (com redimensionamento automático).
- Cadastro de dispositivos (TV e totem) por código de pareamento.

### RF09 — Relatórios básicos
- Por período, serviço e atendente: total de atendimentos, tempo médio de espera, tempo médio de atendimento, taxa de não comparecimento, distribuição por hora.
- Exportação CSV.

## 5. Requisitos não funcionais

- **Tempo real**: WebSocket; latência de chamada ≤ 1 s.
- **Multi-tenant**: todo dado isolado por `tenant_id`; nenhuma consulta sem esse filtro.
- **Resiliência dos dispositivos**: TV e totem reconectam sozinhos, exibem indicador discreto de offline, guardam imagens em cache (Service Worker). O painel continua rodando o carrossel em cache se a internet cair.
- **APIs externas**: chamadas somente pelo servidor, com cache (notícias 15 min, clima 30 min). As TVs nunca chamam APIs externas. Usar apenas provedores que permitam **uso comercial**; provedor de clima e lista de RSS configuráveis.
- **LGPD**: mínimo de dados pessoais; nome opcional; retenção configurável; logs sem dados pessoais.
- **Segurança**: senhas com hash (argon2/bcrypt), sessões com cookie httpOnly, rate limit na emissão pública, tokens próprios por dispositivo.
- **Idioma**: interface em português do Brasil; fuso horário por cliente.
- **Hardware alvo**: TV via TV box Android ou mini PC com Chrome em modo quiosque; totem touch com impressora térmica ESC/POS 80 mm.
- **Deploy**: Docker Compose, compatível com Coolify (VPS própria).

## 6. Decisão em aberto — Totem offline

Se a internet cair, o atendente (web) também perde acesso ao servidor na nuvem. Totem offline isolado gera senhas que ninguém consegue chamar e cria conflito de numeração.

**Decisão para o MVP:** o totem tenta novamente, mostra mensagem clara ("Sistema indisponível, dirija-se ao balcão") e o servidor fica na nuvem. **Fase 2:** "servidor local" opcional (mini PC no cliente) que roda a fila na rede interna e sincroniza com a nuvem — isso resolve offline de verdade para clientes críticos (hospitais, cartórios).

## 7. Fora do escopo do MVP

- Voz na chamada (Fase 2: áudios pré-gravados concatenados — "Senha… A… um, dois, três… guichê… cinco").
- Notificação por WhatsApp/SMS.
- Vídeo no carrossel.
- Agendamento, integrações com sistemas de clínica/cartório.
- Múltiplas unidades por cliente com painel consolidado (o modelo de dados já prevê unidades).
- Classificação de risco hospitalar (Protocolo de Manchester).
- Pesquisa de satisfação integrada (upsell futuro com totens Beend).
- Cobrança/assinatura automática.

## 8. Glossário

- **Senha / ticket**: código que identifica o cliente final na fila.
- **Serviço / fila**: tipo de atendimento (ex.: "Reconhecimento de firma").
- **Guichê / destino**: local físico de atendimento (guichê, mesa, consultório, sala).
- **Encaminhar**: mover a mesma senha para outra fila.
- **Tenant**: cliente da Beend (empresa contratante).
