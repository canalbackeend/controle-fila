/**
 * Illustrations of the help center. The images live in `public/help` and are
 * regenerated with `pnpm help:screenshots`, which draws the numbered marks in
 * the same order as `marks`.
 */
export type HelpFigure = {
  file: string;
  alt: string;
  caption: string;
  marks?: string[];
};

export const helpFigures = {
  adminServices: {
    file: "admin-servicos.jpg",
    alt: "Tela Administração, aba Serviços, com os serviços da clínica",
    caption: "Administração → Serviços",
    marks: [
      "Áreas da administração: serviços, guichês, equipe e unidade",
      "Adicionar um serviço novo",
      "Editar prefixos, forma de chamada e prioridades do serviço",
    ],
  },
  adminTeam: {
    file: "admin-equipe.jpg",
    alt: "Tela Administração, aba Equipe, com as pessoas cadastradas",
    caption: "Administração → Equipe",
    marks: [
      "Aba Equipe",
      "Cadastrar uma pessoa",
      "Editar dados, senha e permissão, ou desativar",
    ],
  },
  attendantShift: {
    file: "atendimento-turno.jpg",
    alt: "Tela Atendimento antes de abrir o turno",
    caption: "Atendimento → Meu turno",
    marks: [
      "Escolha o guichê em que você está",
      "Marque os serviços que vai atender",
      "Ou marque todos de uma vez",
      "Abra o turno",
    ],
  },
  attendantCall: {
    file: "atendimento-chamada.jpg",
    alt: "Tela Atendimento com uma senha chamada no guichê",
    caption: "Atendimento com uma senha chamada",
    marks: [
      "Senha atual e as ações: iniciar, rechamar (R), ausência",
      "Filas do guichê com a quantidade de senhas aguardando",
      "Senhas aguardando: chamar uma senha específica ou cancelar",
      "Emissão no balcão",
    ],
  },
  kioskServices: {
    file: "totem-servicos.jpg",
    alt: "Totem com a lista de serviços para retirar senha",
    caption: "Totem: a pessoa escolhe o serviço",
  },
  kioskPriority: {
    file: "totem-tipo.jpg",
    alt: "Totem com a escolha do tipo de senha",
    caption: "Totem: a pessoa escolhe o tipo de senha",
  },
  kioskReceipt: {
    file: "totem-comprovante.jpg",
    alt: "Comprovante da senha com QR Code no totem",
    caption: "Comprovante com o QR Code de acompanhamento",
  },
  devices: {
    file: "dispositivos.jpg",
    alt: "Tela Dispositivos com o totem e a TV cadastrados",
    caption: "Dispositivos",
    marks: [
      "Cadastrar um totem ou uma TV e gerar o código de pareamento",
      "Configurar a TV: serviços, conteúdo, clima, som e vídeos",
      "Gerar um novo código para parear o aparelho de novo",
    ],
  },
  tvCall: {
    file: "tv-chamada.jpg",
    alt: "Painel de TV mostrando uma senha chamada em destaque",
    caption: "TV durante uma chamada",
  },
  tvIdle: {
    file: "tv-carrossel.jpg",
    alt: "Painel de TV com chamadas anteriores e o carrossel de conteúdo",
    caption: "TV entre as chamadas",
    marks: [
      "Última senha chamada e o guichê",
      "Chamadas anteriores",
      "Carrossel de avisos, notícias, clima e dicas",
      "Letreiro com os avisos da empresa",
    ],
  },
  tvSettings: {
    file: "tv-configuracao.jpg",
    alt: "Tela de configuração da TV com som da chamada e tempos",
    caption: "Dispositivos → Configurar TV e clima",
    marks: [
      "Serviços cujas chamadas aparecem nesta TV",
      "Quanto aparece de cada tipo de conteúdo",
      "Tempo de cada cartão e da chamada em destaque",
      "Salvar as configurações da TV",
    ],
  },
  tracking: {
    file: "celular.jpg",
    alt: "Página de acompanhamento da senha aberta no celular",
    caption: "Acompanhamento pelo celular",
  },
  content: {
    file: "conteudo.jpg",
    alt: "Tela Conteúdo com o logotipo da TV e os avisos cadastrados",
    caption: "Conteúdo",
    marks: [
      "Logotipo exibido no topo da TV",
      "Adicionar aviso, dica ou notícia própria",
      "Conteúdos cadastrados",
    ],
  },
  reports: {
    file: "relatorios.jpg",
    alt: "Tela Relatórios com indicadores e filtros",
    caption: "Relatórios",
    marks: [
      "Filtros por período, serviço e atendente",
      "Exportar para planilha",
      "Indicadores do período",
    ],
  },
  profile: {
    file: "perfil.jpg",
    alt: "Tela Meu perfil com os dados da conta",
    caption: "Perfil",
    marks: ["Nome e e-mail da conta", "Trocar a senha"],
  },
} satisfies Record<string, HelpFigure>;

export type HelpFigureId = keyof typeof helpFigures;
