import type { Role } from "@beend/shared";
import { helpFigures, type HelpFigureId } from "./figures";

export type HelpSection = {
  title: string;
  paragraphs?: string[];
  steps?: string[];
  items?: string[];
  figures?: HelpFigureId[];
};
export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  /** Perfis que veem o artigo. O superadministrador vê todos. */
  audience: Role[];
  sections: HelpSection[];
};

const everyone: Role[] = ["ATTENDANT", "ADMIN", "SUPERADMIN"];
const admins: Role[] = ["ADMIN", "SUPERADMIN"];

export const helpArticles: HelpArticle[] = [
  {
    id: "primeiros-passos",
    title: "Primeiros passos",
    summary: "A ordem recomendada para colocar a unidade em funcionamento.",
    audience: admins,
    sections: [
      {
        title: "Visão geral",
        paragraphs: [
          "O Beend Fila tem quatro telas: o totem, onde a pessoa retira a senha; o painel do atendente, onde a equipe chama e atende; o painel de TV, que mostra as chamadas e conteúdos; e a página do celular, aberta pelo QR Code do comprovante.",
        ],
      },
      {
        title: "Implantação em 7 passos",
        figures: ["adminServices"],
        steps: [
          "Troque a senha inicial em Perfil no primeiro acesso.",
          "Em Administração, aplique um modelo (Clínica, Cartório ou Balcão). O modelo cria serviços, prioridades e guichês prontos.",
          "Ajuste os serviços, os prefixos das senhas e a forma de chamada.",
          "Cadastre ou revise os guichês, mesas e consultórios.",
          "Cadastre a equipe em Administração → Equipe.",
          "Em Dispositivos, cadastre o totem e a TV e faça o pareamento em cada aparelho.",
          "Faça um teste completo: tire uma senha no totem, chame no atendimento, confira a TV e acompanhe pelo celular.",
        ],
      },
    ],
  },
  {
    id: "atendimento",
    title: "Atender a fila",
    summary: "Abrir o turno, chamar, iniciar, encaminhar e finalizar senhas.",
    audience: everyone,
    sections: [
      {
        title: "Abrir o turno",
        figures: ["attendantShift"],
        steps: [
          "Abra Atendimento.",
          "Em Meu turno, escolha o guichê em que você está.",
          "Marque os serviços que vai atender. Use Marcar todos os serviços para atender todas as filas.",
          "Confirme. As filas do guichê aparecem com a quantidade de senhas aguardando.",
        ],
        paragraphs: [
          "Com o turno aberto, use Alterar serviços para mudar as filas sem encerrar o atendimento atual.",
        ],
      },
      {
        title: "Chamar e atender",
        figures: ["attendantCall"],
        steps: [
          "Clique em Chamar próximo ou aperte a barra de Espaço. O sistema escolhe a próxima senha respeitando as prioridades.",
          "A senha aparece na TV com alerta sonoro. Se a pessoa não vier, clique em Rechamar ou aperte R.",
          "Quando a pessoa chegar, clique em Iniciar atendimento.",
          "Ao terminar, clique em Finalizar. Se a pessoa não apareceu, use Não compareceu.",
        ],
      },
      {
        title: "Encaminhar para outra etapa",
        paragraphs: [
          "Durante o atendimento, use Encaminhar para mandar a mesma senha para outro serviço, por exemplo da recepção para a triagem. Você pode indicar um guichê específico ou deixar para qualquer guichê. A senha mantém o código, o QR Code e a prioridade, e entra no fim do grupo da mesma prioridade na nova fila.",
        ],
      },
      {
        title: "Outras ações",
        items: [
          "Chamar senha específica: digite o código (por exemplo, A015) para chamar uma senha fora da ordem.",
          "Cancelar senha: na lista de senhas aguardando, cancela uma senha que não será atendida.",
          "Emissão no balcão: gera uma senha para quem está no balcão, com opção de informar o nome quando o serviço chama pelo nome.",
          "Encerrar turno: libera o guichê. Resolva a senha em atendimento antes.",
        ],
      },
    ],
  },
  {
    id: "prioridades",
    title: "Prioridades e ordem da fila",
    summary: "Como o sistema decide a próxima senha.",
    audience: everyone,
    sections: [
      {
        title: "Tipos de senha",
        items: [
          "Normal.",
          "Preferencial: pessoas com direito ao atendimento prioritário pela Lei nº 10.048/2000.",
          "Prioridade 80+: pessoas com 80 anos ou mais, que pelo Estatuto da Pessoa Idosa têm precedência sobre os demais preferenciais.",
        ],
      },
      {
        title: "Intercalação",
        paragraphs: [
          "Cada serviço tem um ciclo configurável. No padrão, a cada 2 senhas normais é chamada 1 preferencial. Dentro do bloco preferencial, a 80+ sempre vem primeiro.",
          "Se não houver senha do tipo previsto, o sistema chama a do outro tipo para o guichê não ficar parado com gente esperando. Dentro do mesmo tipo, vale a ordem de chegada.",
        ],
      },
      {
        title: "Reinício diário",
        paragraphs: [
          "A numeração recomeça todo dia no horário definido em Administração → Configuração da unidade (padrão 00:00, no fuso da unidade). Senhas que ficaram aguardando do dia anterior são canceladas automaticamente.",
        ],
      },
    ],
  },
  {
    id: "totem",
    title: "Totem de autoatendimento",
    summary: "Instalar, parear e imprimir senhas no totem.",
    audience: admins,
    sections: [
      {
        title: "Cadastrar e parear",
        figures: ["devices"],
        steps: [
          "Em Dispositivos, clique em Cadastrar dispositivo e escolha Totem.",
          "Abra no totem o endereço exibido e digite o código de pareamento. O código vale por 15 minutos e só pode ser usado uma vez.",
          "Gerar um novo código desconecta a instalação anterior do mesmo totem.",
        ],
      },
      {
        title: "Impressão",
        figures: ["kioskReceipt"],
        paragraphs: [
          "O totem imprime o comprovante automaticamente, com unidade, código, serviço, data e hora, pessoas à frente e QR Code. Use impressora térmica de 80 mm configurada como padrão no sistema operacional.",
          "Abra o Chrome com --kiosk --kiosk-printing para imprimir sem a janela de impressão. Sem impressora, acrescente ?impressao=manual ao endereço do totem: o comprovante aparece na tela e só é impresso pelo botão Imprimir senha.",
        ],
      },
      {
        title: "Uso",
        figures: ["kioskServices", "kioskPriority"],
        items: [
          "A pessoa escolhe o serviço e o tipo de senha: são no máximo dois toques.",
          "Depois de 15 segundos sem uso, o totem volta para a tela inicial.",
          "Se a internet ou o sistema cair, o totem mostra a mensagem para procurar o balcão.",
          "Use o botão de tela cheia no canto superior direito.",
        ],
      },
    ],
  },
  {
    id: "painel-tv",
    title: "Painel de TV",
    summary:
      "Parear a TV, som da chamada, conteúdos, notícias, clima e vídeos.",
    audience: admins,
    sections: [
      {
        title: "Instalar",
        steps: [
          "Em Dispositivos, cadastre um Painel de TV e abra o endereço no navegador da TV.",
          "Digite o código de pareamento.",
          "Toque em Toque para iniciar. Esse toque libera o som no navegador.",
          "Use o botão de tela cheia. Em mini PCs, o Chrome com --kiosk --autoplay-policy=no-user-gesture-required dispensa o toque.",
        ],
      },
      {
        title: "Configurar a TV",
        figures: ["tvSettings"],
        paragraphs: [
          "Em Dispositivos, clique em Configurar TV e clima na linha da TV. Ali você define quais serviços aparecem nessa TV (vazio mostra todos), o tempo de cada cartão, o tempo da chamada em destaque e o letreiro do rodapé. Clique em Salvar painel. A TV atualiza sozinha.",
        ],
      },
      {
        title: "Chamada na TV",
        figures: ["tvCall"],
        items: [
          "A senha ocupa a tela ampliada pelo tempo de Segundos de chamada em destaque (5 por padrão), com o guichê de destino.",
          "Toca um bip para chamar a atenção. O conteúdo da TV é sempre mudo.",
          "Chamadas feitas ao mesmo tempo aparecem uma depois da outra, sem se sobrepor.",
          "Quando o serviço chama pelo nome, a TV mostra só o primeiro nome e a inicial do sobrenome.",
        ],
      },
      {
        title: "Conteúdo do carrossel",
        figures: ["tvIdle"],
        items: [
          "Pesos: defina quanto aparece de avisos, notícias, clima e dicas. Peso zero desliga o tipo.",
          "Notícias da TV: aplique um perfil temático com um clique ou escolha os temas em Configuração manual.",
          "Previsão do tempo: informe cidade e estado e coloque o peso do clima acima de zero.",
          "Vídeos da TV: escolha cenas de natureza, a ordem e quantos cartões passam entre os vídeos. Os vídeos são mudos e pausam durante a chamada.",
          "Logotipo: envie em Conteúdo → Logotipo da TV. Use uma versão clara da marca para o fundo escuro.",
        ],
      },
      {
        title: "Sem internet",
        paragraphs: [
          "A TV continua mostrando o último conteúdo recebido e exibe Sem conexão no topo. Ela reconecta sozinha quando a internet volta.",
        ],
      },
    ],
  },
  {
    id: "celular",
    title: "Acompanhamento pelo celular",
    summary: "Como a pessoa acompanha a senha pelo QR Code.",
    audience: everyone,
    sections: [
      {
        title: "Como funciona",
        figures: ["tracking"],
        items: [
          "A pessoa lê o QR Code do comprovante com a câmera do celular. Não precisa de aplicativo nem de cadastro.",
          "A página mostra a senha, o serviço, quantas pessoas estão à frente e o status, atualizando sozinha.",
          "Ao ativar as notificações, o navegador avisa quando faltarem poucas pessoas (3 por padrão) e quando a senha for chamada. A página precisa ficar aberta.",
          "O acompanhamento termina no fim do dia de atendimento.",
          "A página não mostra nenhum dado pessoal.",
        ],
      },
    ],
  },
  {
    id: "administracao",
    title: "Serviços, guichês e equipe",
    summary: "Cadastros da unidade e permissões.",
    audience: admins,
    sections: [
      {
        title: "Serviços",
        figures: ["adminServices"],
        items: [
          "Prefixos: letra das senhas normais, preferenciais e 80+ (por exemplo, A, P e R). Prefixos não se repetem entre serviços.",
          "Forma de chamada: por senha (padrão) ou por nome. Na chamada por nome, a TV mostra só o primeiro nome e a inicial do sobrenome.",
          "Chamadas normais e preferenciais por ciclo: a regra de intercalação do serviço.",
          "Etapa do atendimento: ordena os serviços em fluxos com várias etapas.",
          "Serviços com histórico são desativados em vez de apagados, para preservar os relatórios.",
        ],
      },
      {
        title: "Guichês",
        paragraphs: [
          "Cadastre cada guichê, mesa, sala ou consultório com nome e número. Se um atendente saiu sem encerrar o turno, use Liberar guichê na lista de turnos abertos. Você escolhe se a senha em atendimento volta para a fila ou é cancelada.",
        ],
      },
      {
        title: "Equipe",
        figures: ["adminTeam"],
        items: [
          "Permissão Administrador: configura a unidade, dispositivos, conteúdos e relatórios.",
          "Permissão Atendente: atende a fila e emite senhas no balcão.",
          "A senha precisa ter pelo menos 12 caracteres.",
          "Ao trocar a senha, o e-mail ou a permissão de alguém, as sessões anteriores dessa pessoa são encerradas.",
          "Pessoas que saíram da empresa devem ser desativadas.",
        ],
      },
      {
        title: "Configuração da unidade",
        items: [
          "Nome da empresa e da unidade.",
          "Fuso horário e horário de reinício diário da numeração.",
          "Retenção de nomes em dias: depois desse prazo, os nomes das pessoas atendidas são apagados automaticamente.",
          "Cores: em Configurações, escolha a paleta usada no totem, na TV, no celular e no painel da equipe.",
        ],
      },
    ],
  },
  {
    id: "conteudo",
    title: "Avisos, dicas e notícias próprias",
    summary: "Publicar conteúdo da empresa na TV.",
    audience: admins,
    sections: [
      {
        title: "Cadastrar conteúdo",
        figures: ["content"],
        steps: [
          "Abra Conteúdo e clique em Adicionar conteúdo.",
          "Escolha o tipo: Aviso / anúncio, Curiosidade / dica ou Notícia personalizada.",
          "Preencha título e texto. Se quiser, envie uma imagem JPG, PNG ou WebP. A imagem é ajustada automaticamente.",
          "Defina datas de início e fim para conteúdos temporários, como campanhas.",
          "Salve. As TVs recebem o conteúdo em instantes.",
        ],
        paragraphs: [
          "Publique apenas imagens e textos que a empresa tem direito de usar.",
        ],
      },
    ],
  },
  {
    id: "relatorios",
    title: "Relatórios",
    summary: "Atendimentos, tempos médios e ausências.",
    audience: admins,
    sections: [
      {
        title: "O que mostram",
        figures: ["reports"],
        items: [
          "Atendimentos, não comparecimentos, espera média e atendimento médio, por serviço e atendente.",
          "Distribuição dos atendimentos por hora do dia.",
          "Filtros por período (até 93 dias por consulta), serviço e atendente.",
          "Cada etapa concluída ou encaminhada conta como um atendimento.",
        ],
      },
      {
        title: "Exportar",
        paragraphs: [
          "Clique em Exportar CSV para abrir os dados em planilhas como Excel ou Google Planilhas.",
        ],
      },
    ],
  },
  {
    id: "conta",
    title: "Minha conta e senha",
    summary: "Perfil, troca de senha e cores pessoais.",
    audience: everyone,
    sections: [
      {
        title: "Perfil",
        figures: ["profile"],
        items: [
          "Em Perfil, altere seu nome, e-mail e senha. Para mudar e-mail ou senha, informe a senha atual.",
          "No primeiro acesso, o sistema pede para trocar a senha inicial.",
          "Atendentes podem escolher uma paleta de cores pessoal ou seguir as cores da empresa.",
          "A sessão expira depois de 8 horas. Use Sair ao terminar, principalmente em computadores compartilhados.",
          "Pesquisa de satisfação: a cada 30 dias, o botão preto no canto inferior direito convida você a dar uma nota de 0 a 10 para a beend.tech. A resposta é opcional e vai só para a equipe da Beend.",
        ],
      },
      {
        title: "Esqueci minha senha",
        paragraphs: [
          "Peça ao administrador da sua empresa para definir uma nova senha em Administração → Equipe. Se você é o administrador, fale com o suporte da Beend.",
        ],
      },
    ],
  },
  {
    id: "plataforma",
    title: "Gestão de clientes (Beend)",
    summary: "Cadastrar empresas, limites, suspensão e acessos.",
    audience: ["SUPERADMIN"],
    sections: [
      {
        title: "Cadastrar um cliente",
        figures: ["platformCompanies"],
        steps: [
          "Abra Empresas e clique em Cadastrar empresa.",
          "Informe o identificador, a unidade, o administrador e o plano.",
          "Defina os limites de totens e de TVs. Zero bloqueia o tipo; vazio libera sem limite.",
          "Entregue os dados de Acesso inicial por um canal seguro. A senha inicial só aparece nesse momento.",
        ],
      },
      {
        title: "Gerenciar",
        figures: ["platformSatisfaction"],
        items: [
          "Editar plano e limites: altera as liberações. Para reduzir abaixo do uso, remova dispositivos antes.",
          "Suspender: bloqueia logins, filas, dispositivos e acompanhamento. Os dados são preservados.",
          "Reativar: libera tudo de novo. Dispositivos pareados reconectam sozinhos.",
          "Gerar senha provisória: invalida a senha do administrador e exige troca no primeiro acesso.",
          "Clientes: lista totens e TVs de todas as empresas, com o último contato.",
          "Satisfação: mostra o NPS (porcentagem de promotores menos a de detratores), as notas e os comentários de administradores e atendentes dos clientes, por período. Os nomes e e-mails de quem respondeu não aparecem.",
        ],
      },
    ],
  },
  {
    id: "problemas",
    title: "Resolver problemas",
    summary: "Perguntas frequentes e soluções rápidas.",
    audience: everyone,
    sections: [
      {
        title: "A TV não toca som",
        paragraphs: [
          "Toque em Toque para iniciar depois de abrir ou recarregar a página. Confira o volume e a saída de áudio da TV.",
        ],
      },
      {
        title: "A senha chamada não aparece na TV",
        paragraphs: [
          "Em Configurar TV e clima, veja se o serviço está entre os serviços exibidos nessa TV. Com nenhum serviço marcado, a TV mostra todos.",
        ],
      },
      {
        title: "A TV ou o totem mostram Sem conexão ou Reconectando",
        paragraphs: [
          "Verifique a internet do aparelho. Ele reconecta sozinho. Se aparecer a tela de pareamento, gere um novo código em Dispositivos.",
        ],
      },
      {
        title: "O totem abre a janela de impressão a cada senha",
        paragraphs: [
          "Abra o Chrome com a opção --kiosk-printing e deixe a impressora térmica como padrão. Sem impressora, use ?impressao=manual no endereço.",
        ],
      },
      {
        title: "O guichê aparece ocupado",
        paragraphs: [
          "Outra pessoa está com o turno aberto nesse guichê. Peça para ela encerrar o turno ou peça ao administrador para usar Liberar guichê.",
        ],
      },
      {
        title: "Nenhuma senha aguardando, mas há gente na fila",
        paragraphs: [
          "Confira em Alterar serviços se o seu guichê atende o serviço daquela fila.",
        ],
      },
    ],
  },
  {
    id: "privacidade",
    title: "Privacidade e LGPD",
    summary: "Como o sistema protege os dados pessoais.",
    audience: everyone,
    sections: [
      {
        title: "Resumo",
        items: [
          "O totem não pede nenhum dado pessoal. O nome só é usado quando o serviço chama pelo nome e é informado no balcão.",
          "A TV mostra só o primeiro nome e a inicial do sobrenome.",
          "A página do celular não mostra dados pessoais e expira no fim do dia.",
          "Os nomes são apagados automaticamente após o prazo de retenção da empresa.",
          "Cada empresa só acessa os próprios dados.",
        ],
        paragraphs: [
          "Os detalhes estão na Política de Privacidade e nos Termos de Uso, com links no rodapé desta página.",
        ],
      },
    ],
  },
];

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function articleText(article: HelpArticle) {
  return [
    article.title,
    article.summary,
    ...article.sections.flatMap((section) => [
      section.title,
      ...(section.paragraphs ?? []),
      ...(section.steps ?? []),
      ...(section.items ?? []),
      ...(section.figures ?? []).flatMap((id) => {
        const figure: { caption: string; marks?: string[] } = helpFigures[id];
        return [figure.caption, ...(figure.marks ?? [])];
      }),
    ]),
  ].join(" ");
}

export function articlesFor(role: Role, query = "") {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return helpArticles.filter((article) => {
    if (role !== "SUPERADMIN" && !article.audience.includes(role)) return false;
    const text = normalize(articleText(article));
    return terms.every((term) => text.includes(term));
  });
}
