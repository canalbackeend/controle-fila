import { createHash } from "node:crypto";
import Parser from "rss-parser";
import { z } from "zod";
import { categorySchema, newsTopics } from "@beend/shared";
import { prisma } from "../../db.js";
import { storeImage } from "./assets.js";
import { remoteContent } from "./remote.js";

const sources = z
  .array(
    z.object({
      url: z.url().refine((value) => new URL(value).protocol === "https:"),
      category: categorySchema,
    }),
  )
  .max(30);
const officialFeeds = new Map([
  ["https://www.camara.leg.br/noticias/rss/ultimas-noticias", "Agência Câmara"],
  ["https://www12.senado.leg.br/noticias/RSS", "Agência Senado"],
]);
const topicPatterns: Record<keyof typeof newsTopics, RegExp> = {
  saude:
    /\b(saude|sus|vacina\w*|hospital\w*|medicamento\w*|diabetes|cancer|doenca\w*|medic\w*|bem-estar)\b/,
  esportes:
    /\b(esporte\w*|futebol|jiu-jitsu|copa|olimpi\w*|atleta\w*|paradesport\w*)\b/,
  tecnologia:
    /\b(ciencia|cientific\w*|tecnolog\w*|inovacao|inteligencia artificial|internet|datacenter)\b/,
  ambiente:
    /\b(ambient\w*|clima\w*|bioma\w*|floresta\w*|reciclagem|desmatamento)\b/,
  educacao:
    /\b(educa\w*|escol\w*|universidade\w*|aluno\w*|cultura\w*|museu\w*|biblioteca\w*)\b/,
  servicos:
    /\b(cidadania|consumidor\w*|idos\w*|cartori\w*|certid\w*|cadunico|servicos publicos)\b/,
  economia:
    /\b(economia|emprego\w*|empres\w*|impost\w*|orcamento|salari\w*|negocio\w*|trabalh\w*|credito\w*|empreendedor\w*)\b/,
};
const normalize = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

function headlineTopic(title: string) {
  const headline = normalize(title);
  if (
    /\b(policia\w*|crime\w*|criminal\w*|seguranca publica|homicid\w*)\b/.test(
      headline,
    )
  )
    return "policia";
  if (
    /\b(eleicoes|eleicao|eleitor\w*|partidari\w*|campanha eleitoral|impeachment)\b/.test(
      headline,
    )
  )
    return "politica";
  return (
    Object.entries(topicPatterns).find(([, pattern]) =>
      pattern.test(headline),
    )?.[0] ?? "geral"
  );
}
type Media = { $?: { url?: string } };
type NewsEntry = { media?: Media | Media[]; thumbnail?: Media | Media[] };
const parser = new Parser<object, NewsEntry>({
  customFields: {
    item: [
      ["media:content", "media"],
      ["media:thumbnail", "thumbnail"],
    ],
  },
});

export function defaultNewsCategory(category: string) {
  return !/polic|politic|crime|seguranca/.test(normalize(category));
}

export async function configureSources() {
  const configured = new Map(
    [...officialFeeds.keys()].map((url) => [url, "geral"]),
  );
  for (const { url, category } of sources.parse(
    JSON.parse(process.env.RSS_FEEDS || "[]"),
  ))
    configured.set(url, category);
  await prisma.$transaction([
    prisma.feedSource.updateMany({
      where: { global: true, url: { notIn: [...configured.keys()] } },
      data: { active: false },
    }),
    ...[...configured].map(([url, category]) =>
      prisma.feedSource.upsert({
        where: { url },
        update: { category, active: true },
        create: { url, category },
      }),
    ),
  ]);
}

async function openGraph(url: URL) {
  const html = (await remoteContent(url, 450_000)).toString();
  for (const match of html.matchAll(/<meta\s[^>]+>/gi)) {
    const property = /(?:name|property)\s*=\s*["']og:image(?::url)?["']/i.test(
      match[0],
    );
    const value = /\bcontent\s*=\s*(["'])(.*?)\1/i.exec(match[0])?.[2];
    if (property && value) return value.replace(/&amp;/g, "&");
  }
  return undefined;
}

export async function refreshNews(onError: (feedId: string) => void) {
  const feeds = await prisma.feedSource.findMany({
    where: { global: true, active: true },
  });
  for (const feed of feeds) {
    try {
      const base = new URL(feed.url);
      const parsed = await parser.parseString(
        (await remoteContent(base, 1_500_000)).toString(),
      );
      const official = officialFeeds.get(feed.url);
      const feedTitle =
        official ?? (parsed.title?.trim().slice(0, 100) || base.hostname);
      const entries = parsed.items
        .filter(
          (item) =>
            item.title?.trim() &&
            (!official ||
              (item.title.trim().length <= 180 &&
                !/^(Áudio|Vídeo):/i.test(item.title.trim()))),
        )
        .slice(0, official ? 40 : 12);
      const ids = entries.map((item) =>
        createHash("sha256")
          .update(item.guid || item.link || item.title || "")
          .digest("hex"),
      );
      const known = await prisma.newsItem.findMany({
        where: { sourceId: feed.id, externalId: { in: ids } },
        select: { externalId: true, category: true, imageUrl: true },
      });
      for (const [index, item] of entries.entries()) {
        const externalId = ids[index]!;
        const category = official ? headlineTopic(item.title!) : feed.category;
        const existing = known.find((entry) => entry.externalId === externalId);
        if (
          existing?.category === category &&
          (!official || !existing.imageUrl)
        )
          continue;
        const articleDate = new Date(
          item.isoDate ?? item.pubDate ?? Date.now(),
        );
        const publishedAt = Number.isNaN(articleDate.getTime())
          ? new Date()
          : articleDate;
        let imageUrl: string | undefined;
        try {
          const first = (value: Media | Media[] | undefined) =>
            (Array.isArray(value) ? value[0] : value)?.$?.url;
          const image = official
            ? undefined
            : (item.enclosure?.type?.startsWith("image/")
                ? item.enclosure.url
                : undefined) ||
              first(item.media) ||
              first(item.thumbnail) ||
              (item.link
                ? await openGraph(new URL(item.link, base))
                : undefined);
          if (image)
            imageUrl = await storeImage(
              await remoteContent(
                new URL(image, item.link ? new URL(item.link, base) : base),
                6_000_000,
              ),
            );
        } catch {
          /* Retain the headline if its image cannot be retrieved. */
        }
        const data = {
          sourceId: feed.id,
          externalId,
          title: item.title!.trim().slice(0, 180),
          imageUrl: official ? null : imageUrl,
          source:
            official &&
            item.creator &&
            !normalize(item.creator).includes(normalize(official))
              ? `${feedTitle} · ${item.creator}`
              : feedTitle,
          category,
          publishedAt,
        };
        await prisma.newsItem.upsert({
          where: { sourceId_externalId: { sourceId: feed.id, externalId } },
          create: data,
          update: data,
        });
      }
    } catch {
      onError(feed.id);
    }
  }
  await prisma.newsItem.deleteMany({
    where: { publishedAt: { lt: new Date(Date.now() - 14 * 86_400_000) } },
  });
}
