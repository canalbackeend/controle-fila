import { randomUUID } from "node:crypto";
import { templateConfig, type Actor } from "@beend/shared";

import { prisma, tenantDb } from "../../db.js";
import { HttpError } from "../../errors.js";

const entries = [
  {
    id: "clinic",
    name: "Clínica",
    services: [
      ["Recepção", "R"],
      ["Triagem", "T"],
      ["Consultório", "C"],
    ],
    counters: ["Recepção", "Triagem", "Consultório"],
  },
  {
    id: "registry",
    name: "Cartório",
    services: [
      ["Informações", "I"],
      ["Reconhecimento de firma", "F"],
      ["Registros", "G"],
    ],
    counters: ["Guichê 1", "Guichê 2", "Guichê 3"],
  },
  {
    id: "retail",
    name: "Balcão / Varejo",
    services: [
      ["Atendimento", "A"],
      ["Retirada", "E"],
    ],
    counters: ["Balcão 1", "Balcão 2"],
  },
];

export const templates = entries.map(({ id, name, services, counters }) => ({
  id,
  name,
  config: templateConfig.parse({
    services: services.map(([name, prefix], index) => ({
      name,
      prefix,
      preferentialPrefix: prefix + "P",
      priority80Prefix: prefix + "S",
      stageOrder: index + 1,
    })),
    counters: counters.map((name, index) => ({ name, number: index + 1 })),
  }),
}));

export async function templateCatalog() {
  const saved = await prisma.template.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return [
    ...new Map(
      [...templates.map(({ id, name }) => ({ id, name })), ...saved].map(
        (template) => [template.id, template],
      ),
    ).values(),
  ];
}

export async function findTemplate(id: string) {
  const saved = await prisma.template.findUnique({ where: { id } });
  return saved
    ? templateConfig.parse(saved.config)
    : templates.find((template) => template.id === id)?.config;
}

export async function saveTemplate(actor: Actor, name: string) {
  const db = tenantDb(actor.tenantId);
  const where = { unitId: actor.unitId, active: true };
  const [services, counters] = await Promise.all([
    db.service.findMany({ where, orderBy: { stageOrder: "asc" } }),
    db.counter.findMany({ where, orderBy: { number: "asc" } }),
  ]);
  if (!services.length || !counters.length)
    throw new HttpError(
      409,
      "Cadastre pelo menos um serviço e um guichê ativos antes de salvar o modelo.",
    );
  const config = templateConfig.parse({ services, counters });
  return prisma.template.create({
    data: { id: `custom-${randomUUID()}`, name, config },
    select: { id: true, name: true },
  });
}
