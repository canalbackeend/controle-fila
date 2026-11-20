import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import type { PanelScene, PanelSceneId } from "@beend/shared";
import { panelSceneId } from "@beend/shared";
import { uploads } from "./assets.js";
import { remoteContent } from "./remote.js";

const clips = {
  "misty-river": {
    label: "Rio com neblina",
    title: "Um momento de calma",
    text: "Respire no seu ritmo. Observe o rio seguir seu caminho.",
    seconds: 47,
    file: "Misty_river_47_seconds.webm",
    hash: "9/9e",
    author: "Digitura",
    license: "CC0",
    deed: "publicdomain/zero/1.0/",
  },
  "ocean-waves": {
    label: "Ondas nas rochas",
    title: "No ritmo do mar",
    text: "Acompanhe o movimento das ondas.",
    seconds: 43,
    file: "Ocean_waves.webm",
    hash: "1/11",
    author: "Matti Schneider",
    license: "CC BY-SA 3.0",
    deed: "licenses/by-sa/3.0/",
  },
  waterfall: {
    label: "Cachoeira na mata",
    title: "Uma pausa na natureza",
    text: "Repare no caminho da água entre as pedras.",
    seconds: 33,
    file: "20200722_182642_taughannock_falls_waterfall.webm",
    hash: "4/4d",
    author: "G. Edward Johnson",
    license: "CC BY 3.0",
    deed: "licenses/by/3.0/",
  },
  "snowy-mountains": {
    label: "Montanhas cobertas de neve",
    title: "Olhe mais longe",
    text: "Deixe o olhar descansar na paisagem.",
    seconds: 26,
    file: "Aerial_view_of_snowy_landscape.webm",
    hash: "0/05",
    author: "Mecha.Me",
    license: "CC0",
    deed: "publicdomain/zero/1.0/",
  },
} satisfies Record<
  PanelSceneId,
  {
    label: string;
    title: string;
    text: string;
    seconds: number;
    file: string;
    hash: string;
    author: string;
    license: string;
    deed: string;
  }
>;

const directory = resolve(uploads, "scene-videos");
const pathFor = (id: PanelSceneId) => resolve(directory, `${id}.webm`);
const fileSize = (id: PanelSceneId) =>
  stat(pathFor(id)).then(
    (info) => (info.isFile() ? info.size : 0),
    () => 0,
  );

export const videoCatalog = panelSceneId.options.map((id) => {
  const { file, deed, label, title, text, seconds, author, license } =
    clips[id];
  return {
    id,
    label,
    title,
    text,
    seconds,
    author,
    license,
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
    licenseUrl: `https://creativecommons.org/${deed}`,
  };
});

export async function availableScenes(
  ids: PanelSceneId[],
): Promise<PanelScene[]> {
  const scenes = await Promise.all(
    ids.map(async (id) => {
      const scene = videoCatalog.find((clip) => clip.id === id);
      return scene && (await fileSize(id))
        ? { ...scene, videoUrl: `/api/scene-videos/${id}` }
        : undefined;
    }),
  );
  return scenes.filter((scene) => scene !== undefined);
}

export async function cacheSceneVideos(onError: (id: PanelSceneId) => void) {
  await mkdir(directory, { recursive: true });
  let count = 0;
  for (const id of panelSceneId.options) {
    if (await fileSize(id)) continue;
    const { file, hash } = clips[id];
    const url = new URL(
      `https://upload.wikimedia.org/wikipedia/commons/transcoded/${hash}/${file}/${file}.480p.vp9.webm`,
    );
    const temporary = resolve(directory, randomUUID());
    try {
      const buffer = await remoteContent(url, 16 * 1024 * 1024, "video/webm");
      if (buffer.readUInt32BE(0) !== 0x1a45dfa3)
        throw new Error("Expected WebM video");
      await writeFile(temporary, buffer, { flag: "wx" });
      await rename(temporary, pathFor(id));
      count++;
    } catch {
      onError(id);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  return count;
}

export function videoSceneRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/scene-videos/:id",
    async (request, reply) => {
      const id = panelSceneId.safeParse(request.params.id).data;
      const size = id ? await fileSize(id) : 0;
      if (!id || !size) return reply.code(404).send();
      const range = request.headers.range;
      const match = range?.match(/^bytes=(\d*)-(\d*)$/);
      const start = match?.[1]
        ? Number(match[1])
        : match?.[2]
          ? Math.max(0, size - Number(match[2]))
          : 0;
      const end =
        match?.[1] && match[2]
          ? Math.min(size - 1, Number(match[2]))
          : size - 1;
      if (
        range &&
        (!match || (!match[1] && !match[2]) || start >= size || start > end)
      ) {
        return reply
          .code(416)
          .header("Content-Range", `bytes */${size}`)
          .send();
      }
      if (match)
        reply
          .code(206)
          .header("Content-Range", `bytes ${start}-${end}/${size}`);
      reply
        .type("video/webm")
        .header("Accept-Ranges", "bytes")
        .header("Content-Length", end - start + 1)
        .header("Cache-Control", "public, max-age=86400")
        .header("X-Content-Type-Options", "nosniff");
      return reply.send(createReadStream(pathFor(id), { start, end }));
    },
  );
}
