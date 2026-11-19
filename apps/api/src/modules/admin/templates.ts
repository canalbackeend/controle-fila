import { templateConfig } from "@beend/shared";

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
