import type { Card, PanelConfig } from "@prisma/client";
import {
  defaultPanelSettings,
  type DisplayCard,
  type ManagedCard,
  type PanelSettings,
} from "@beend/shared";
import { prisma, tenantDb } from "../../db.js";
import { defaultNewsCategory } from "./news.js";
import { weatherCard, weatherData } from "./weather.js";

export function settingsFor(saved: PanelConfig | null): PanelSettings {
  if (!saved) return defaultPanelSettings;
  return {
    serviceIds: saved.serviceIds,
    weights: {
      ...defaultPanelSettings.weights,
      ...(saved.weights as PanelSettings["weights"]),
    },
    city: saved.city,
    newsCategories: saved.newsCategories,
    cardSeconds: saved.cardSeconds,
    callDisplaySeconds: saved.callDisplaySeconds,
    ticker: saved.ticker,
  };
}

export function managed(card: Card): ManagedCard {
  return {
    ...card,
    global: card.tenantId === null,
    validFrom: card.validFrom?.toISOString() ?? null,
    validTo: card.validTo?.toISOString() ?? null,
  };
}

export async function panelContent(tenantId: string, config: PanelSettings) {
  const db = tenantDb(tenantId);
  const now = new Date();
  const where = {
    active: true,
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
      { OR: [{ validTo: null }, { validTo: { gte: now } }] },
    ],
  };
  const [local, global, news, weatherRow] = await Promise.all([
    db.card.findMany({ where, orderBy: { id: "desc" }, take: 80 }),
    prisma.card.findMany({
      where: { ...where, tenantId: null, type: "TIP" },
      orderBy: { id: "desc" },
      take: 40,
    }),
    config.weights.NEWS > 0
      ? prisma.newsItem.findMany({
          where: {
            feed: { active: true, global: true },
            publishedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
            ...(config.newsCategories.length
              ? { category: { in: config.newsCategories } }
              : {}),
          },
          orderBy: { publishedAt: "desc" },
          take: 75,
        })
      : [],
    prisma.weatherCache.findUnique({ where: { city: config.city } }),
  ]);
  const weather =
    weatherRow && now.getTime() - weatherRow.fetchedAt.getTime() < 6 * 3600000
      ? weatherData.safeParse(weatherRow.payload).data
      : undefined;
  const cards: DisplayCard[] = [
    ...[...local, ...global].map(({ id, type, title, text, imageUrl }) => ({
      id,
      type,
      title,
      text,
      imageUrl: imageUrl ?? undefined,
    })),
    ...news
      .filter(
        ({ category }) =>
          config.newsCategories.length || defaultNewsCategory(category),
      )
      .slice(0, 20)
      .map((item): DisplayCard => ({
        id: item.id,
        type: "NEWS",
        title: item.title,
        text: "",
        imageUrl: item.imageUrl ?? undefined,
        source: item.source,
      })),
    ...(weather ? [weatherCard(config.city, weather)] : []),
  ];
  return {
    cards: cards.filter((card) => config.weights[card.type] > 0),
    temperature: weather?.temperature,
  };
}
