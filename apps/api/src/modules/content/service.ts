import type {
  Card,
  NewsIllustration,
  NewsItem,
  PanelConfig,
} from "@prisma/client";
import {
  defaultPanelSettings,
  newsPresets,
  weatherStateSchema,
  type DisplayCard,
  type ManagedCard,
  type PanelSettings,
} from "@beend/shared";
import { prisma, tenantDb } from "../../db.js";
import { defaultNewsCategory, sportsNewsLicense } from "./news.js";
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

async function recentHeadlines(config: PanelSettings, now: Date) {
  const { newsCategories } = config;
  const where = {
    feed: { active: true, global: true },
    publishedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
  };
  const orderBy = [{ publishedAt: "desc" }, { id: "asc" }] as const;
  const preferred = await prisma.newsItem.findMany({
    where: {
      ...where,
      ...(newsCategories.length ? { category: { in: newsCategories } } : {}),
    },
    orderBy: [...orderBy],
    take: 160,
  });
  const headlines = new Map<string, NewsItem>();
  const append = (items: NewsItem[], target: number) => {
    for (const item of items) {
      if (headlines.size >= target) break;
      const key = item.title
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
      if (!headlines.has(key)) headlines.set(key, item);
    }
  };
  append(
    newsCategories.length
      ? preferred
      : preferred.filter(({ category }) => defaultNewsCategory(category)),
    40,
  );
  const preset =
    config.newsMode === "AUTO" &&
    newsCategories.length > 0 &&
    Object.values(newsPresets).some(
      ({ categories }) =>
        categories.length === newsCategories.length &&
        categories.every((category) => newsCategories.includes(category)),
    );
  if (preset && headlines.size < 16) {
    const supplements = await prisma.newsItem.findMany({
      where: { ...where, category: { notIn: newsCategories } },
      orderBy: [...orderBy],
      take: 160,
    });
    append(
      supplements.filter(({ category }) => defaultNewsCategory(category)),
      16,
    );
  }
  return [...headlines.values()];
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
    showFeed ? recentHeadlines(config, now) : [],
    showFeed
      ? prisma.newsIllustration.findMany({ orderBy: { fileTitle: "asc" } })
      : [],
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
  const illustrationsByCategory = new Map<string, NewsIllustration[]>();
  for (const illustration of illustrations) {
    const pool = illustrationsByCategory.get(illustration.category) ?? [];
    pool.push(illustration);
    illustrationsByCategory.set(illustration.category, pool);
  }
  const photoOffsets = new Map<string, number>();
  const cards: DisplayCard[] = [
    ...[...local, ...global].map(({ id, type, title, text, imageUrl }) => ({
      id,
      type,
      title,
      text,
      imageUrl: imageUrl ?? undefined,
      source: type === "NEWS" ? "Notícias da unidade" : undefined,
    })),
    ...news.map((item): DisplayCard => {
      const category = illustrationsByCategory.has(item.category)
        ? item.category
        : "geral";
      const pool = illustrationsByCategory.get(category);
      const offset = photoOffsets.get(category) ?? 0;
      const illustration =
        !item.imageUrl && pool ? pool[offset % pool.length] : undefined;
      if (illustration) photoOffsets.set(category, offset + 1);
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
        sourceUrl: item.articleUrl ?? undefined,
        sourceLicenseUrl: item.articleUrl ? sportsNewsLicense : undefined,
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
