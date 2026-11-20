import { z } from "zod";
import { prisma } from "../../db.js";
import { storeImage } from "./assets.js";
import { remoteContent } from "./remote.js";

const commons = "https://commons.wikimedia.org";

const catalog = [
  {
    category: "geral",
    fileTitle: "File:Curitiba skyline.jpg",
    author: "O Bicho Geográfico",
  },
  {
    category: "geral",
    fileTitle: "File:Panorama da Esplanada dos Ministérios.jpg",
    author: "Adriel Marcos",
  },
  {
    category: "saude",
    fileTitle: "File:2023 Stetoskop.jpg",
    author: "Jacek Halicki",
  },
  {
    category: "saude",
    fileTitle: "File:Instrumentos medicos de uso en Cardiología.jpg",
    author: "Ivan2010",
  },
  {
    category: "economia",
    fileTitle: "File:Avenida Faria Lima, São Paulo.jpg",
    author: "Wilfredor",
  },
  {
    category: "economia",
    fileTitle: "File:Paulista Avenue, São Paulo, Brazil.jpg",
    author: "Wilfredor",
  },
  {
    category: "educacao",
    fileTitle:
      "File:2018 Rio de Janeiro Interior do Real Gabinete Português de Leitura.jpg",
    author: "Felipe Restrepo Acosta",
  },
  {
    category: "educacao",
    fileTitle:
      "File:Hamamatsu Municipal Sakuma Library reading room ac (1).jpg",
    author: "Asturio Cantabrio",
  },
  {
    category: "tecnologia",
    fileTitle: "File:CircuitBoardByDesignermadsen.jpg",
    author: "Kent Madsen",
  },
  {
    category: "tecnologia",
    fileTitle: "File:Raspberry Pi 4 Model B - Top.jpg",
    author: "Laserlicht",
  },
  {
    category: "esportes",
    fileTitle:
      "File:Panoramic view of the Sesc Porto Alegre soccer field (20260213181625).jpg",
    author: "Lenny Maidana",
  },
  {
    category: "esportes",
    fileTitle: "File:Tow surfing Nazaré.jpg",
    author: "Robinnmulller",
  },
  {
    category: "ambiente",
    fileTitle: "File:Amazon Rainforest.jpg",
    author: "Antonio Campoy",
  },
  {
    category: "ambiente",
    fileTitle: "File:Amazon rainforest, Brazil - 2026.jpg",
    author: "flowcomm",
  },
];

const licenses: Readonly<Record<string, string>> = {
  CC0: "https://creativecommons.org/publicdomain/zero/1.0/",
  "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
};

const response = z.object({
  query: z.object({
    pages: z.array(
      z.object({
        title: z.string(),
        imageinfo: z.array(z.unknown()).optional(),
      }),
    ),
  }),
});

const photo = z.object({
  thumburl: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["thumb.wikimedia.org", "upload.wikimedia.org"].includes(url.hostname)
    );
  }),
  extmetadata: z.object({
    LicenseShortName: z.object({ value: z.string() }),
  }),
});

export async function syncNewsIllustrations(
  onError: (category: string) => void,
) {
  const cached = await prisma.newsIllustration.findMany({
    select: { category: true, fileTitle: true },
  });
  const missing = catalog.filter(
    ({ category, fileTitle }) =>
      !cached.some(
        (entry) => entry.category === category && entry.fileTitle === fileTitle,
      ),
  );
  if (!missing.length) return 0;

  const url = new URL("/w/api.php", commons);
  url.search = new URLSearchParams({
    action: "query",
    titles: missing.map(({ fileTitle }) => fileTitle).join("|"),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiextmetadatafilter: "LicenseShortName",
    iiurlwidth: "1280",
    format: "json",
    formatversion: "2",
  }).toString();
  const { query } = response.parse(
    JSON.parse((await remoteContent(url, 250_000)).toString()),
  );
  const images = new Map(
    query.pages.map((page) => [page.title, page.imageinfo?.[0]]),
  );

  let imported = 0;
  for (const { category, fileTitle, author } of missing) {
    try {
      const metadata = photo.parse(images.get(fileTitle));
      const license = metadata.extmetadata.LicenseShortName.value;
      const licenseUrl = licenses[license];
      if (typeof licenseUrl !== "string")
        throw new Error("Unsupported image license");
      const imageUrl = await storeImage(
        await remoteContent(new URL(metadata.thumburl), 4_000_000),
      );
      const sourceUrl = `${commons}/wiki/${encodeURIComponent(fileTitle.replaceAll(" ", "_"))}`;
      const illustration = {
        fileTitle,
        imageUrl,
        author,
        license,
        licenseUrl,
        sourceUrl,
      };
      await prisma.newsIllustration.upsert({
        where: { category_fileTitle: { category, fileTitle } },
        create: { category, ...illustration },
        update: illustration,
      });
      imported++;
    } catch {
      onError(category);
    }
  }
  return imported;
}
