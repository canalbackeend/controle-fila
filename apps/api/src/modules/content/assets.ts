import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { assetUrlSchema } from "@beend/shared";
import { z } from "zod";
import { HttpError, missing } from "../../errors.js";
import { requireActor } from "../auth/service.js";

const uploads =
  process.env.UPLOAD_DIR ||
  fileURLToPath(new URL("../../../../../uploads", import.meta.url));
const maxFileSize = 6 * 1024 * 1024;
const fileParams = z.object({
  file: z.string().regex(/^[a-f0-9]{64}\.(?:webp|png)$/),
});
const assetQuery = z.object({
  format: z.enum(["webp", "png"]).default("webp"),
});
type AssetFormat = z.output<typeof assetQuery>["format"];

export async function storeImage(blob: Buffer, format: AssetFormat = "webp") {
  const input = sharp(blob, { limitInputPixels: 24_000_000 });
  const metadata = await input.metadata();
  if (
    !metadata.format ||
    !["jpeg", "png", "webp", "gif", "avif"].includes(metadata.format)
  )
    throw new Error("Unsupported image");
  const resized = input.rotate().resize({
    width: 1920,
    height: 1080,
    fit: "inside",
    withoutEnlargement: true,
  });
  const image = await (
    format === "png" ? resized.png() : resized.webp({ quality: 82 })
  ).toBuffer();
  const filename = `${createHash("sha256").update(image).digest("hex")}.${format}`;
  await mkdir(uploads, { recursive: true });
  await writeFile(resolve(uploads, filename), image, { flag: "wx" }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    },
  );
  return `/api/assets/${filename}`;
}

export async function requireAsset(url: string | null) {
  if (!url) return;
  const name = assetUrlSchema.parse(url).split("/").at(-1)!;
  await access(resolve(uploads, name)).catch(() =>
    missing("Imagem indisponível."),
  );
}

export function assetRoutes(app: FastifyInstance) {
  app.post("/admin/assets", async (request, reply) => {
    await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { format } = assetQuery.parse(request.query);
    const file = await request.file({
      limits: { files: 1, fileSize: maxFileSize, parts: 1 },
    });
    if (!file) throw new HttpError(400, "Selecione uma imagem.");
    const buffer = await file.toBuffer();
    try {
      return reply
        .code(201)
        .send({ imageUrl: await storeImage(buffer, format) });
    } catch {
      throw new HttpError(400, "Envie uma imagem JPG, PNG ou WebP válida.");
    }
  });
  app.get("/assets/:file", async (request, reply) => {
    const { file } = fileParams.parse(request.params);
    const path = resolve(uploads, file);
    await access(path).catch(() => missing("Imagem indisponível."));
    return reply
      .type(file.endsWith(".png") ? "image/png" : "image/webp")
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .send(createReadStream(path));
  });
}
