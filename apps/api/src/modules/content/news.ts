import { createHash } from "node:crypto";
import Parser from "rss-parser";
import { z } from "zod";
import { categorySchema } from "@beend/shared";
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
  const clean = category
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return !/polic|politic|crime|seguranca/.test(clean);
}

export async function configureSources() {
  const configured = sources.parse(JSON.parse(process.env.RSS_FEEDS || "[]"));
  await prisma.$transaction([
    prisma.feedSource.updateMany({
      where: { global: true, url: { notIn: configured.map(({ url }) => url) } },
      data: { active: false },
    }),
    ...configured.map(({ url, category }) =>
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
      const source = parsed.title?.trim().slice(0, 100) || base.hostname;
      const entries = parsed.items
        .filter((item) => item.title?.trim())
        .slice(0, 12);
      const ids = entries.map((item) =>
        createHash("sha256")
          .update(item.guid || item.link || item.title || "")
          .digest("hex"),
      );
      const known = await prisma.newsItem.findMany({
        where: { sourceId: feed.id, externalId: { in: ids } },
        select: { externalId: true },
      });
      for (const [index, item] of entries.entries()) {
        const externalId = ids[index]!;
        if (known.some(({ externalId: existing }) => existing === externalId))
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
          const image =
            (item.enclosure?.type?.startsWith("image/")
              ? item.enclosure.url
              : undefined) ||
            first(item.media) ||
            first(item.thumbnail) ||
            (item.link ? await openGraph(new URL(item.link, base)) : undefined);
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
          imageUrl,
          source,
          category: feed.category,
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
