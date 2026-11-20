/**
 * Dados da Beend exibidos na Política de Privacidade, nos Termos de Uso e na
 * Central de Ajuda. Campos vazios não aparecem nas páginas.
 */
export const company = {
  brand: "beend.tech",
  product: "Beend Fila",
  legalName: "",
  document: "",
  address: "Brasília/DF - Brasil",
  privacyEmail: "",
  support: {
    email: "suporte@beend.tech",
    phone: "+55 (61) 9 9595-7461",
    whatsapp: "+55 (61) 9 9595-7461",
    hours: "",
  },
  legalUpdatedAt: "20 de novembro de 2026",
};

export function supportChannels() {
  const { email, whatsapp, hours } = company.support;
  return [
    email && { label: "E-mail", value: email, href: `mailto:${email}` },
    whatsapp && {
      label: "WhatsApp",
      value: whatsapp,
      href: `https://wa.me/${whatsapp.replace(/\D/g, "")}`,
    },
    hours && { label: "Horário", value: hours },
  ].filter(Boolean) as { label: string; value: string; href?: string }[];
}
