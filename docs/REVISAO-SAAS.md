# Revisão de prontidão do Beend Fila

19 de novembro de 2026

O fluxo principal está disponível no ambiente local. A liberação comercial depende da recuperação de guichês, do encerramento de sessões após alterações de acesso, da operação em HTTPS e da homologação com equipamentos reais.

## Fluxo revisado

| Etapa | O que está disponível |
| --- | --- |
| Beend | Cadastro de empresa e primeiro administrador, senha provisória, limites separados de totens e TVs, suspensão, reativação e recuperação de acesso |
| Administração do cliente | Aplicação de modelos, serviços e prioridades, guichês, equipe, avisos, logo da TV, tema da empresa e pareamento |
| Atendimento | Emissão no totem ou balcão, senhas normal, preferencial e 80+, chamada, rechamada, início, encaminhamento, finalização e ausência |
| TV e celular | Chamadas em fila, alerta sonoro, carrossel, acompanhamento por QR Code e atualização da posição e do status |
| Relatórios | Filtros por período, serviço e atendente, tempos médios, ausências, distribuição horária e exportação CSV |

A paleta compartilhada da Clínica Demo foi configurada em vermelho. O guichê do Bruno foi configurado para acompanhar essa paleta. Em **Meu perfil**, o administrador pode conferir o nome da empresa antes de salvar as cores. Cada empresa preserva a própria configuração.

## Validação desta revisão

- Lint, tipagem e build passaram. Os 20 testes com PostgreSQL e os 10 testes de navegador passaram na rodada final. A primeira execução com as duas suítes concorrendo excedeu limites de tempo no ambiente local.
- O fluxo de navegador validou emissão, chamada, TV, celular, encaminhamento e finalização. A regressão de tema conferiu as cores renderizadas no guichê de outro navegador e na TV aberta, além da atualização do totem.
- O teste de plataforma cobriu o primeiro acesso do cliente, o limite de dispositivos, o acesso aos relatórios, a suspensão e a reativação.
- O dump PostgreSQL local mais recente foi restaurado em um contêiner temporário sem rede, com conferência da tabela de empresas. Os arquivos de mídia passaram no teste de leitura. Ainda falta restaurar banco e mídia juntos no ambiente de produção e repetir o fluxo completo.

## Antes do primeiro cliente pagante

| Prioridade | Pendência | Critério de aceite |
| --- | --- | --- |
| P0 | Recuperar guichê ocupado por turno abandonado ou por conta desativada | Um administrador do cliente consegue liberar o guichê e tratar eventual senha ativa com registro no histórico. O guichê pode ser assumido por outro atendente. |
| P0 | Revogar acessos após troca de senha, desativação ou remoção de privilégios pelo administrador | Sessões HTTP antigas deixam de operar e conexões de tempo real da conta afetada são encerradas. |
| P0 | Publicar em domínio HTTPS e validar o percurso de fora da rede local | O cliente entra por HTTPS, o totem e a TV conectam pelo endereço definitivo e um celular na rede móvel abre o QR impresso e recebe as atualizações. A credencial de superadmin usada no ambiente local deve ser trocada antes da publicação. |
| P0 | Configurar monitoramento e recuperação | Monitorar disponibilidade da API e do banco, falhas e idade do backup, armazenamento e funcionamento do tempo real. Manter cópias externas do banco e dos uploads e ensaiar a restauração com verificação do fluxo. |
| P0 | Homologar o kit de instalação e a capacidade do serviço | Imprimir em térmica de 80 mm, validar leitura do QR, áudio e reconexão da TV, medir chamada em até 1 segundo, concluir a rodada de 24 horas e acompanhar a meta de sete dias do PRD. Medir também o cadastro de uma clínica em até 30 minutos. |
| P1 | Configurar fontes ao vender clima e notícias | Definir a cidade, o provedor de clima e os feeds autorizados para exibição comercial. Com dados reais, conferir temperatura no topo da TV e previsão e notícias no carrossel. |
| P1 | Fechar a operação comercial manual | Definir plano e limites por cliente, responsáveis por cobrança e suporte, entrega da senha provisória e regras de ativação e suspensão. O sistema já oferece os controles de acesso para essa operação. |

### Evidências técnicas

- O início de turno verifica se já existe um turno aberto no guichê. O encerramento encontra apenas o turno do próprio atendente, e o cadastro administrativo desativa usuários sem liberar seus turnos. [Turnos](../apps/api/src/modules/attendant/service.ts#L92) · [Equipe](../apps/api/src/modules/admin/routes.ts#L164)
- A troca de senha no cadastro da equipe atualiza o hash. A invalidação de cookies depende de `credentialsChangedAt`. A troca pelo perfil e a recuperação de administradores na plataforma já usam esse campo. [Equipe](../apps/api/src/modules/admin/routes.ts#L146) · [Sessões](../apps/api/src/modules/auth/service.ts#L42)
- O Docker local publica a aplicação em `http://localhost:8180`. O endpoint de saúde confirma que a API responde sem consultar o PostgreSQL. O backup gera arquivos no mesmo host e registra falhas em log. Foram conferidos o catálogo dos dumps e a leitura dos arquivos de mídia. [Saúde da API](../apps/api/src/app.ts#L26) · [Backup](../deploy/backup.sh#L17)
- A chave de clima e a lista RSS estavam vazias no ambiente local. O teste automatizado de conteúdo usa dados de teste para conferir a exibição. [Coleta de clima](../apps/api/src/modules/content/jobs.ts#L19) · [Teste de carrossel](../e2e/content.spec.ts#L4)

Começar pela recuperação de turnos e pela revogação de acessos. Em seguida, homologar o domínio HTTPS e a rotina de restauração e instalar o primeiro kit físico numa clínica piloto. Os passos de instalação estão no [guia de dispositivos](DISPOSITIVOS.md), e o cadastro está no [guia da operação SaaS](OPERACAO-SAAS.md).
