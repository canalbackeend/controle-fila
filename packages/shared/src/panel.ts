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
  source?: string;
  weather?: {
    temperature: number;
    days: { day: string; min: number; max: number }[];
  };
};
export type PanelSettings = WeatherLocation & {
  serviceIds: string[];
  weights: Record<ContentType, number>;
  cardSeconds: number;
  newsCategories: string[];
  callDisplaySeconds: number;
  ticker: string;
};
export type PanelData = {
  theme: TenantTheme;
  unitName: string;
  logoUrl?: string;
  timeZone: string;
  config: PanelSettings;
  calls: PanelCall[];
  cards: DisplayCard[];
  temperature?: number;
  weatherSource?: string;
};
export const defaultPanelSettings: PanelSettings = {
  serviceIds: [],
  weights: { NOTICE: 50, NEWS: 30, WEATHER: 20, TIP: 20 },
  cardSeconds: 10,
  newsCategories: [],
  city: "São Paulo",
  state: "SP",
  callDisplaySeconds: 5,
  ticker: "",
};

import { z } from "zod";
import { idSchema, nameSchema } from "./admin.js";

export const contentTypes = ["NOTICE", "NEWS", "WEATHER", "TIP"] as const;
const weight = z.coerce.number().int().min(0).max(100);
export const categorySchema = z.string().trim().toLowerCase().min(1).max(60);
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
  newsCategories: z
    .array(categorySchema)
    .max(30)
    .transform((categories) => [...new Set(categories)]),
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
    type: z.enum(["NOTICE", "TIP"]),
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
};

export function pickPanelCard(
  cards: DisplayCard[],
  weights: PanelSettings["weights"],
  previous?: string,
  random = Math.random,
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
    if (draw < 0) return items[Math.floor(random() * items.length)];
  }
  return undefined;
}
