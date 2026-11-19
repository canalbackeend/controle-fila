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
- **Recuperar acesso** gera uma nova senha inicial para o e-mail de um administrador ativo do cliente. A senha anterior perde a validade e esse administrador precisa trocar a nova senha inicial no próximo acesso.

O plano comercial é um nome de referência. A contratação, o recebimento e a decisão de suspender ou reativar são manuais. Para disponibilizar o sistema aos clientes, configure um domínio HTTPS e a rotina de backup conforme o [guia de deploy](DEPLOY.md).
