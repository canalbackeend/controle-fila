import type { TenantTheme } from "./theme.js";
import type { PanelCall } from "./attendant.js";

export const brazilianStates = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
} as const;
export type BrazilianState = keyof typeof brazilianStates;
export type WeatherLocation = { city: string; state: BrazilianState | null };

export type ContentType = "NOTICE" | "NEWS" | "WEATHER" | "TIP";
export type DisplayCard = {
  id: string;
  type: ContentType;
  title: string;
  text: string;
  imageUrl?: string;
  imageCredit?: {
    author: string;
    license: string;
    licenseUrl: string;
    sourceUrl: string;
  };
  source?: string;
  sourceUrl?: string;
  sourceLicenseUrl?: string;
  weather?: {
    temperature: number;
    days: { day: string; min: number; max: number }[];
  };
};
export type PanelSettings = WeatherLocation & {
  serviceIds: string[];
  weights: Record<ContentType, number>;
  cardSeconds: number;
  newsMode: "AUTO" | "CUSTOM";
  newsCategories: string[];
  callDisplaySeconds: number;
  ticker: string;
  sceneIds: PanelSceneId[];
  sceneFrequency: number;
};
export type PanelData = {
  theme: TenantTheme;
  unitName: string;
  logoUrl?: string;
  timeZone: string;
  config: PanelSettings;
  calls: PanelCall[];
  cards: DisplayCard[];
  scenes: PanelScene[];
  temperature?: number;
  weatherSource?: string;
};
export const defaultPanelSettings: PanelSettings = {
  serviceIds: [],
  weights: { NOTICE: 50, NEWS: 30, WEATHER: 20, TIP: 20 },
  cardSeconds: 10,
  newsMode: "AUTO",
  newsCategories: [],
  city: "São Paulo",
  state: "SP",
  callDisplaySeconds: 5,
  ticker: "",
  sceneIds: [],
  sceneFrequency: 3,
};

import { z } from "zod";
import { idSchema, nameSchema } from "./admin.js";

export const panelSceneIds = [
  "misty-river",
  "ocean-waves",
  "waterfall",
  "snowy-mountains",
] as const;
export const panelSceneId = z.enum(panelSceneIds);
export type PanelSceneId = z.infer<typeof panelSceneId>;
export type PanelScene = {
  id: PanelSceneId;
  label: string;
  title: string;
  text: string;
  seconds: number;
  videoUrl: string;
  author: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
};
export const panelVideoInput = z.object({
  sceneIds: z
    .array(panelSceneId)
    .max(panelSceneIds.length)
    .transform((ids) => [...new Set(ids)]),
  sceneFrequency: z.coerce.number().int().min(1).max(10),
});

export const contentTypes = ["NOTICE", "NEWS", "WEATHER", "TIP"] as const;
const weight = z.coerce.number().int().min(0).max(100);
export const categorySchema = z.string().trim().toLowerCase().min(1).max(60);
export const newsTopics = {
  saude: "Saúde e bem-estar",
  economia: "Economia e trabalho",
  educacao: "Educação e cultura",
  tecnologia: "Ciência e tecnologia",
  esportes: "Esportes e lazer",
  ambiente: "Meio ambiente",
  servicos: "Cidadania e serviços",
} as const;
export const newsPresets = {
  geral: { label: "Geral", categories: [] },
  saude: { label: "Saúde e bem-estar", categories: ["saude", "servicos"] },
  negocios: {
    label: "Negócios e trabalho",
    categories: ["economia", "tecnologia"],
  },
  educacao: {
    label: "Educação e cultura",
    categories: ["educacao", "tecnologia"],
  },
  esportes: { label: "Esportes e lazer", categories: ["esportes"] },
} satisfies Record<string, { label: string; categories: string[] }>;
const newsCategories = z
  .array(categorySchema)
  .max(30)
  .transform((categories) => [...new Set(categories)]);
export const panelNewsInput = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("AUTO"),
    preset: z.enum(Object.keys(newsPresets) as (keyof typeof newsPresets)[]),
  }),
  z.object({ mode: z.literal("CUSTOM"), categories: newsCategories }),
]);
export type PanelNewsSelection = z.output<typeof panelNewsInput>;
export const weatherStateSchema = z.enum(
  Object.keys(brazilianStates) as BrazilianState[],
);
export const panelInput = z.object({
  serviceIds: z
    .array(idSchema)
    .max(100)
    .transform((ids) => [...new Set(ids)]),
  weights: z.object({
    NOTICE: weight,
    NEWS: weight,
    WEATHER: weight,
    TIP: weight,
  }),
  cardSeconds: z.coerce.number().int().min(5).max(30),
  newsCategories: newsCategories.optional(),
  city: nameSchema,
  state: weatherStateSchema.nullable().default(null),
  callDisplaySeconds: z.coerce.number().int().min(2).max(30),
  ticker: z.string().trim().max(400),
});
export const assetUrlSchema = z
  .string()
  .regex(/^\/api\/assets\/[a-f0-9]{64}\.(?:webp|png)$/);
export const cardInput = z
  .object({
    type: z.enum(["NOTICE", "TIP", "NEWS"]),
    title: z.string().trim().min(1).max(130),
    text: z.string().trim().max(300),
    imageUrl: assetUrlSchema.nullable().default(null),
    validFrom: z.iso.datetime().nullable().default(null),
    validTo: z.iso.datetime().nullable().default(null),
    active: z.boolean().default(true),
    global: z.boolean().default(false),
  })
  .refine(
    (card) =>
      !card.validFrom || !card.validTo || card.validFrom <= card.validTo,
    { path: ["validTo"] },
  );
export type ManagedCard = z.output<typeof cardInput> & { id: string };
export type PanelEditorData = {
  name: string;
  config: PanelSettings;
  services: { id: string; name: string }[];
  categories: string[];
  videoCatalog: Omit<PanelScene, "videoUrl">[];
};

export function pickPanelCard(
  cards: DisplayCard[],
  weights: PanelSettings["weights"],
  previous?: string,
  random = Math.random,
  newsHistory?: readonly string[],
) {
  const enabled = cards.filter((card) => weights[card.type] > 0);
  const alternatives = enabled.filter((card) => card.id !== previous);
  const candidates = alternatives.length ? alternatives : enabled;
  const groups = contentTypes
    .map((type) => ({
      type,
      items: candidates.filter((item) => item.type === type),
    }))
    .filter(({ items }) => items.length);
  const total = groups.reduce((sum, { type }) => sum + weights[type], 0);
  let draw = random() * total;
  for (const { type, items } of groups) {
    draw -= weights[type];
    if (draw >= 0) continue;
    if (type !== "NEWS" || !newsHistory)
      return items[Math.floor(random() * items.length)];
    const unseen = items.filter(({ id }) => !newsHistory.includes(id));
    const rotation = unseen.length ? unseen : items;
    const lastNews = enabled.find(({ id }) => id === newsHistory.at(-1));
    return (
      rotation.find(
        ({ imageUrl }) => imageUrl && imageUrl !== lastNews?.imageUrl,
      ) ?? rotation[0]
    );
  }
  return undefined;
}

type PanelRotation = { id?: string; newsHistory: readonly string[] };

export function advancePanelRotation(
  cards: DisplayCard[],
  weights: PanelSettings["weights"],
  previous: PanelRotation = { newsHistory: [] },
  random = Math.random,
): PanelRotation {
  const newsHistory = previous.newsHistory.filter((id) =>
    cards.some((card) => card.type === "NEWS" && card.id === id),
  );
  const next = pickPanelCard(cards, weights, previous.id, random, newsHistory);
  return {
    id: next?.id,
    newsHistory:
      next?.type !== "NEWS"
        ? newsHistory
        : newsHistory.includes(next.id)
          ? [next.id]
          : [...newsHistory, next.id],
  };
}
