# Instalação de totem e painel de TV

Use o mesmo domínio HTTPS da aplicação em todos os dispositivos. Em **Administração → Dispositivos**, cadastre o tipo desejado, abra seu endereço no equipamento e informe o código de pareamento. O código é válido por 15 minutos e pode ser usado uma vez. Gerar um novo código desconecta a instalação anterior.

No totem e no painel de TV, toque no ícone de quatro cantos no topo à direita para entrar em tela cheia. Toque no mesmo botão para sair. O painel ainda pode pedir **Toque para iniciar** para liberar o som.

## Totem e impressão

1. Instale a impressora térmica no sistema operacional via driver ou fila compatível com o modelo ESC/POS. Faça um teste pelo sistema e selecione a impressora como padrão.
2. Configure papel de 80 mm, escala de 100%, margens mínimas e sem cabeçalho ou rodapé do navegador.
3. Abra o Chrome em modo quiosque com impressão direta. Substitua o endereço do exemplo pelo endereço do totem já cadastrado.

```sh
chrome --kiosk --kiosk-printing "https://fila.suaempresa.com.br/totem/ID-DO-TOTEM"
```

Selecione um serviço e um tipo de senha. O totem imprime o comprovante automaticamente, com unidade, código, serviço, data e hora, pessoas à frente e QR Code. Escaneie o QR com um celular conectado à internet. A opção **Imprimir senha** no comprovante permite repetir a impressão da mesma senha.

Em um totem sem impressora, por exemplo durante testes, acrescente `?impressao=manual` ao endereço, como em `https://fila.suaempresa.com.br/totem/ID-DO-TOTEM?impressao=manual`. O comprovante aparece na tela e só é impresso pelo botão **Imprimir senha**. Sem a flag `--kiosk-printing`, o Chrome abre a janela de impressão a cada senha. Se o servidor ficar indisponível, o totem orienta a pessoa a procurar o balcão.

## Painel de TV

```sh
chrome --kiosk --autoplay-policy=no-user-gesture-required "https://fila.suaempresa.com.br/painel/ID-DO-PAINEL"
```

No primeiro uso da tela, selecione **Toque para iniciar**. Configure a saída de áudio do equipamento e faça uma chamada de teste. Valide a leitura do código a cinco metros, o alerta sonoro, a fila de destaque e a retomada do carrossel. Em equipamentos Android que não aceitam essas flags, use o modo de tela cheia do navegador e toque para liberar o áudio.

Em produção, o painel usa cache do navegador para continuar exibindo o último conteúdo enquanto tenta se reconectar. Confirme a reconexão após desligar e restaurar a rede. Para homologação, mantenha a TV ativa por 24 horas e observe o uso de memória no DevTools em intervalos regulares. A meta operacional do PRD é uma semana sem intervenção.
