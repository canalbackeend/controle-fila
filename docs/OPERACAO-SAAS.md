# Operação SaaS do Beend Fila

## Cadastrar um cliente

1. Entre na conta de superadministrador da Beend e abra **Empresas**.
2. Selecione **Cadastrar empresa**. Informe o identificador, a primeira unidade, o administrador e o plano comercial.
3. Defina separadamente o número máximo de totens e painéis de TV. Um zero bloqueia novos cadastros do tipo. Um campo vazio representa liberação sem limite.
4. Copie os dados de **Acesso inicial** e entregue-os ao administrador do cliente por um canal seguro. A senha inicial só é exibida nessa etapa e precisa ser trocada no primeiro acesso.
5. Oriente o cliente a aplicar um modelo ou criar seus serviços e guichês. Ele pode cadastrar a equipe, parear os dispositivos permitidos e consultar os relatórios da própria unidade.

## Gerenciar o acesso

- **Editar plano e limites** altera as liberações do cliente. Cada dispositivo cadastrado ocupa uma vaga, inclusive se ainda aguarda pareamento. Para reduzir o limite abaixo do uso, remova primeiro os dispositivos excedentes.
- **Suspender** bloqueia logins, filas, dispositivos e acompanhamento público da empresa. Os registros são preservados para reativação.
- **Reativar** libera novamente a operação. Dispositivos que ainda têm o token de pareamento voltam a conectar.
- **Ver acessos** mostra o endereço de login, o identificador da empresa e os e-mails dos administradores. **Gerar senha provisória** invalida a senha anterior e exige troca no primeiro acesso. A nova senha provisória é exibida no momento em que é gerada.
- **Dispositivos dos clientes** lista totens e TVs com empresa, unidade e último contato. A tela abre filtrada pelos equipamentos online. Um dispositivo pareado aparece como online quando fez contato nos últimos 90 segundos e a empresa está ativa.

O plano comercial é um nome de referência. A contratação, o recebimento e a decisão de suspender ou reativar são manuais. Para disponibilizar o sistema aos clientes, configure um domínio HTTPS e a rotina de backup conforme o [guia de deploy](DEPLOY.md).

## Gerenciar turnos

- Em **Atendimento → Meu turno**, escolha um guichê livre e marque os serviços que vai atender. Use **Marcar todos os serviços** para atender todas as filas da unidade. Com o turno aberto, use **Alterar serviços** para ajustar a seleção sem encerrar o atendimento atual.
- Para iniciar outro turno, use **Encerrar turno** na mesma seção depois de resolver a senha em atendimento. A área **Administração → Guichês** também tem um atalho para **Gerenciar meu turno**.

## Recuperar um guichê ou acesso da equipe

- Em **Administração → Guichês**, selecione **Liberar guichê** no turno aberto. Se houver uma senha ativa, escolha se ela deve voltar à fila ou ser cancelada. Confirme para liberar o guichê para outro atendente. A senha que retorna mantém código, QR Code e prioridade.
- Em **Administração → Equipe**, edite a pessoa e salve a nova senha. A conta afetada precisa entrar novamente com a nova senha. A troca encerra as sessões anteriores em todos os navegadores.
