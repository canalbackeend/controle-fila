# Decisões do MVP

- Cada empresa começa com uma unidade operacional. O cadastro mantém a unidade explícita para permitir a expansão do modelo.
- O código de uma senha é único na unidade durante a data operacional. O prefixo pode ser compartilhado entre tipos do mesmo serviço porque a sequência é comum aos três tipos. Prefixos entre serviços da unidade são reservados, inclusive depois da desativação.
- Cadastros em uso são desativados para preservar o histórico.
- A porta web local é 5180. A URL da aplicação é configurada por ambiente.
- A intercalação começa com o bloco normal. O 80+ sempre tem precedência no bloco preferencial. Se o tipo previsto estiver vazio, a chamada do outro tipo mantém a posição do ciclo.
- A virada usa o horário local do tenant. Senhas aguardando de datas anteriores são canceladas e registradas pelo job. Atendimentos em andamento podem ser concluídos no guichê.
- O encaminhamento mantém o código e entra no fim do grupo de prioridade da etapa de destino. A posição impressa representa a fila no momento da emissão.
- Os códigos de pareamento são descartáveis, expiram em 15 minutos e incluem o identificador da empresa. Gerar outro código revoga o token anterior do dispositivo.
- O comprovante do totem é enviado para impressão após a emissão. A tela permite reimprimir a mesma senha antes de voltar ao início.
- O painel guarda o conteúdo do carrossel no dispositivo e limita o cache de imagens. O cache persistente não contém histórico de chamadas por nome.
- O primeiro uso da TV pede um toque para liberar o áudio. Em quiosques dedicados, o Chrome oferece a flag `--autoplay-policy=no-user-gesture-required`.
- As fontes RSS são configuradas por ambiente e precisam autorizar a exibição comercial. O servidor guarda miniaturas locais e usa o último clima válido por até seis horas se o provedor falhar.
- Os pesos do painel são relativos entre as categorias habilitadas com conteúdo disponível. Em cada troca, o cartão anterior é excluído quando há outra opção.
