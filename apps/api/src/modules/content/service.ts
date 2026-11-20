import type { Card, PanelConfig } from "@prisma/client";
import {
  defaultPanelSettings,
  weatherStateSchema,
  type DisplayCard,
  type ManagedCard,
  type PanelSettings,
} from "@beend/shared";
import { prisma, tenantDb } from "../../db.js";
import { defaultNewsCategory } from "./news.js";
import { weatherCacheKey, weatherCard, weatherData } from "./weather.js";

export function settingsFor(saved: PanelConfig | null): PanelSettings {
  if (!saved) return defaultPanelSettings;
  return {
    serviceIds: saved.serviceIds,
    weights: {
      ...defaultPanelSettings.weights,
      ...(saved.weights as PanelSettings["weights"]),
    },
    city: saved.city,
    state: weatherStateSchema.safeParse(saved.state).data ?? null,
    newsMode: saved.newsMode === "CUSTOM" ? "CUSTOM" : "AUTO",
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
  const showFeed =
    config.weights.NEWS > 0 &&
    (config.newsMode === "AUTO" || config.newsCategories.length > 0);
  const [local, global, news, illustrations, weatherRow] = await Promise.all([
    db.card.findMany({ where, orderBy: { id: "desc" }, take: 80 }),
    prisma.card.findMany({
      where: { ...where, tenantId: null, type: "TIP" },
      orderBy: { id: "desc" },
      take: 40,
    }),
    showFeed
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
    showFeed ? prisma.newsIllustration.findMany() : [],
    config.weights.WEATHER > 0
      ? prisma.weatherCache.findUnique({
          where: { city: weatherCacheKey(config) },
        })
      : null,
  ]);
  const weather =
    weatherRow && now.getTime() - weatherRow.fetchedAt.getTime() < 6 * 3600000
      ? weatherData.safeParse(weatherRow.payload).data
      : undefined;
  const illustrationsByCategory = new Map(
    illustrations.map((illustration) => [illustration.category, illustration]),
  );
  const cards: DisplayCard[] = [
    ...[...local, ...global].map(({ id, type, title, text, imageUrl }) => ({
      id,
      type,
      title,
      text,
      imageUrl: imageUrl ?? undefined,
      source: type === "NEWS" ? "Notícias da unidade" : undefined,
    })),
    ...news
      .filter(
        ({ category }) =>
          config.newsCategories.length || defaultNewsCategory(category),
      )
      .slice(0, 20)
      .map((item): DisplayCard => {
        const illustration = item.imageUrl
          ? undefined
          : (illustrationsByCategory.get(item.category) ??
            illustrationsByCategory.get("geral"));
        return {
          id: item.id,
          type: "NEWS",
          title: item.title,
          text: "",
          imageUrl: item.imageUrl ?? illustration?.imageUrl,
          imageCredit: illustration && {
            author: illustration.author,
            license: illustration.license,
            licenseUrl: illustration.licenseUrl,
            sourceUrl: illustration.sourceUrl,
          },
          source: item.source,
        };
      }),
    ...(weather ? [weatherCard(config, weather)] : []),
  ];
  return {
    cards: cards.filter((card) => config.weights[card.type] > 0),
    temperature: weather?.temperature,
    weatherSource: weather?.source,
  };
}
