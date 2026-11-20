import { company } from "./company";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};
export type LegalDocument = {
  title: string;
  intro: string;
  sections: LegalSection[];
};

const contactEmail = company.privacyEmail || company.support.email;
const contact = contactEmail
  ? `pelo e-mail ${contactEmail}`
  : "pelos canais de atendimento informados no contrato";
const identity = [
  company.legalName,
  company.document && `CNPJ ${company.document}`,
  company.address,
]
  .filter(Boolean)
  .join(", ");

export const privacyPolicy: LegalDocument = {
  title: "Política de Privacidade",
  intro: `Esta política explica como o ${company.product} trata dados pessoais. O ${company.product} é um sistema de controle de filas usado por clínicas, cartórios, comércios e outros estabelecimentos para organizar o atendimento ao público.`,
  sections: [
    {
      title: "1. Quem é responsável pelos dados",
      paragraphs: [
        `O ${company.product} é fornecido pela ${company.brand}${identity ? ` (${identity})` : ""}.`,
        "Cada estabelecimento que contrata o sistema decide quais dados coleta das pessoas que atende e para quê. Por isso, o estabelecimento é o controlador desses dados, e a Beend atua como operadora: trata os dados em nome dele e conforme as instruções dele, nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).",
        "Para os dados das contas de acesso da equipe dos estabelecimentos, a Beend também atua como controladora, na medida necessária para prestar o serviço contratado.",
      ],
    },
    {
      title: "2. Dados das pessoas atendidas",
      paragraphs: ["Para emitir e acompanhar uma senha, o sistema registra:"],
      items: [
        "o código da senha, o serviço escolhido e o tipo de atendimento (normal, preferencial ou prioridade 80+);",
        "os horários de emissão, chamada, início e fim do atendimento, o guichê e os encaminhamentos;",
        "um código aleatório que permite acompanhar a senha pelo celular, sem login;",
        "o nome, somente quando o estabelecimento chama pelo nome. O nome é informado no balcão, nunca é obrigatório no totem e é apagado automaticamente após o prazo de retenção definido pelo estabelecimento (30 dias por padrão).",
      ],
    },
    {
      title: "3. O que não coletamos das pessoas atendidas",
      paragraphs: [
        "O sistema não pede CPF, telefone, e-mail, endereço, data de nascimento, localização ou qualquer documento. A página de acompanhamento pelo celular não exibe dados pessoais, e o painel de TV mostra apenas o primeiro nome e a inicial do sobrenome quando a chamada é feita pelo nome.",
        "O tipo de atendimento escolhido pode indicar que a pessoa tem direito à prioridade legal. Essa informação é usada apenas para respeitar a ordem de atendimento prevista em lei.",
      ],
    },
    {
      title: "4. Dados da equipe dos estabelecimentos",
      items: [
        "nome, e-mail, perfil de acesso e preferências de cor da tela;",
        "senha, guardada de forma criptografada (hash) e nunca em texto aberto;",
        "turnos e ações realizadas no atendimento, como chamar, encaminhar e finalizar senhas, para o funcionamento da fila e para os relatórios do estabelecimento.",
      ],
    },
    {
      title: "5. Dados técnicos e cookies",
      paragraphs: [
        "O sistema usa um único cookie, necessário para manter a sessão da equipe conectada por até 8 horas. Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros.",
        "Totens e painéis de TV guardam no próprio aparelho um código de pareamento e uma cópia do conteúdo exibido, para continuar funcionando se a internet oscilar. O endereço IP das conexões é usado no momento do acesso para limitar tentativas abusivas e proteger o serviço.",
      ],
    },
    {
      title: "6. Para que usamos os dados",
      items: [
        "organizar a fila, chamar as pessoas e respeitar as prioridades legais (Lei nº 10.048/2000 e Estatuto da Pessoa Idosa);",
        "permitir o acompanhamento da senha pelo celular e os avisos no navegador;",
        "gerar relatórios de atendimento para o estabelecimento;",
        "manter a segurança do sistema, prevenir fraudes e prestar suporte.",
      ],
      paragraphs: [
        "As bases legais são a execução do contrato com o estabelecimento, o cumprimento de obrigação legal sobre prioridade de atendimento e o legítimo interesse na segurança do serviço. Não vendemos dados pessoais nem os usamos para publicidade.",
      ],
    },
    {
      title: "7. Com quem os dados são compartilhados",
      paragraphs: [
        "Os dados ficam em servidores contratados pela Beend para hospedar o sistema, com acesso restrito. O serviço de previsão do tempo recebe apenas o nome da cidade configurada no painel. Notícias, fotos e vídeos exibidos na TV são buscados pelo servidor, sem envio de dados pessoais. Também poderemos compartilhar dados quando houver obrigação legal ou ordem de autoridade competente.",
        "Se algum fornecedor de infraestrutura mantiver servidores fora do Brasil, a transferência seguirá as salvaguardas previstas no artigo 33 da LGPD.",
      ],
    },
    {
      title: "8. Por quanto tempo guardamos",
      items: [
        "o acompanhamento pelo celular deixa de funcionar ao fim do dia de atendimento;",
        "os nomes das pessoas atendidas são apagados após o prazo de retenção configurado pelo estabelecimento;",
        "o histórico de atendimento, sem nomes, é mantido enquanto durar o contrato, para os relatórios;",
        "as cópias de segurança são mantidas por até 14 dias;",
        "ao fim do contrato, os dados do estabelecimento são excluídos ou devolvidos, conforme o contrato.",
      ],
    },
    {
      title: "9. Segurança",
      paragraphs: [
        "Usamos conexão criptografada (HTTPS), senhas protegidas por hash, separação dos dados de cada estabelecimento, controle de permissões por perfil, limite de tentativas de acesso e cópias de segurança. Nenhum sistema é totalmente imune a incidentes. Se ocorrer um incidente relevante, os estabelecimentos afetados e, quando exigido, a Autoridade Nacional de Proteção de Dados serão comunicados.",
      ],
    },
    {
      title: "10. Seus direitos",
      paragraphs: [
        "A LGPD garante, entre outros, o direito de confirmar se seus dados são tratados, acessá-los, corrigi-los, pedir a exclusão e obter informações sobre o compartilhamento.",
        "Se você foi atendido em um estabelecimento que usa o sistema, faça o pedido diretamente a esse estabelecimento, que é o responsável pelos seus dados. A Beend apoiará o estabelecimento na resposta.",
        `Se você é usuário da equipe de um estabelecimento, fale com o administrador da sua empresa ou com a Beend ${contact}.`,
      ],
    },
    {
      title: "11. Alterações desta política",
      paragraphs: [
        "Esta política pode ser atualizada para refletir mudanças no sistema ou na legislação. A data da última atualização aparece no início da página.",
      ],
    },
  ],
};

export const termsOfUse: LegalDocument = {
  title: "Termos de Uso",
  intro: `Estes termos regulam o uso do ${company.product} pelos estabelecimentos contratantes, por suas equipes e pelas pessoas que retiram e acompanham senhas. Ao usar o sistema, você concorda com estes termos.`,
  sections: [
    {
      title: "1. O serviço",
      paragraphs: [
        `O ${company.product} permite emitir senhas no totem ou no balcão, chamar pessoas pelo painel do atendente, exibir as chamadas e conteúdos em painéis de TV e acompanhar a senha pelo celular. As condições comerciais, como plano, preço, número de dispositivos e suporte, constam do contrato firmado com cada estabelecimento.`,
      ],
    },
    {
      title: "2. Contas de acesso",
      items: [
        "cada pessoa da equipe deve usar sua própria conta e manter a senha em sigilo;",
        "o administrador do estabelecimento é responsável por criar, alterar e desativar as contas da sua equipe;",
        "atividades realizadas com uma conta são de responsabilidade do estabelecimento ao qual ela pertence;",
        "avise a Beend ao suspeitar de uso indevido de uma conta ou de um dispositivo.",
      ],
    },
    {
      title: "3. Responsabilidades do estabelecimento",
      items: [
        "configurar os serviços, as prioridades e os guichês de acordo com a legislação aplicável à sua atividade;",
        "informar as pessoas atendidas sobre o tratamento de dados pessoais, como controlador desses dados;",
        "garantir que tem direito de uso sobre logotipos, imagens, avisos e textos que publicar no painel;",
        "manter os equipamentos (TV, totem, impressora e internet) em condições de funcionamento;",
        "manter um procedimento de atendimento no balcão caso o sistema ou a internet fiquem indisponíveis.",
      ],
    },
    {
      title: "4. Uso permitido",
      paragraphs: [
        "É proibido usar o sistema para fins ilegais, publicar conteúdo ofensivo ou enganoso, tentar acessar dados de outros estabelecimentos, contornar limites técnicos ou de segurança, ou sobrecarregar o serviço de forma intencional.",
      ],
    },
    {
      title: "5. Conteúdo de terceiros",
      paragraphs: [
        "Notícias, previsão do tempo, fotos e vídeos exibidos no painel vêm de fontes externas autorizadas e são apresentados com o devido crédito. A Beend não se responsabiliza pela exatidão desse conteúdo e pode trocar ou remover fontes a qualquer momento.",
      ],
    },
    {
      title: "6. Disponibilidade",
      paragraphs: [
        "A Beend trabalha para manter o sistema disponível e seguro, mas podem ocorrer interrupções por manutenção, falhas de internet, de energia ou de fornecedores. Os painéis de TV continuam exibindo o último conteúdo recebido enquanto tentam se reconectar, e o totem orienta a pessoa a procurar o balcão quando o sistema está indisponível.",
      ],
    },
    {
      title: "7. Suspensão",
      paragraphs: [
        "O acesso pode ser suspenso em caso de violação destes termos, inadimplência ou risco à segurança, conforme o contrato. A suspensão preserva os dados para uma eventual reativação.",
      ],
    },
    {
      title: "8. Propriedade intelectual",
      paragraphs: [
        `O software, a marca e o design do ${company.product} pertencem à Beend. O contrato concede ao estabelecimento o direito de uso do sistema durante a vigência da contratação. Os dados e conteúdos inseridos pelo estabelecimento continuam sendo dele.`,
      ],
    },
    {
      title: "9. Limitação de responsabilidade",
      paragraphs: [
        "Na extensão permitida pela lei, a Beend não responde por danos indiretos ou por prejuízos decorrentes de configuração incorreta, de mau uso, de falhas dos equipamentos do estabelecimento ou de indisponibilidade de internet. Os limites de responsabilidade constam do contrato.",
      ],
    },
    {
      title: "10. Privacidade",
      paragraphs: [
        "O tratamento de dados pessoais segue a Política de Privacidade do sistema.",
      ],
    },
    {
      title: "11. Alterações e legislação",
      paragraphs: [
        "Estes termos podem ser atualizados, com aviso aos estabelecimentos quando a mudança for relevante. Aplica-se a legislação brasileira.",
        `Dúvidas sobre estes termos podem ser enviadas ${contact}.`,
      ],
    },
  ],
};
