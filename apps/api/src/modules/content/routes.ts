import type { FastifyInstance } from "fastify";
import { refreshWeather } from "./weather-cache.js";
import {
  assetUrlSchema,
  cardInput,
  defaultPanelSettings,
  idParams,
  idSchema,
  newsPresets,
  newsTopics,
  panelInput,
  panelNewsInput,
  panelVideoInput,
  type PanelEditorData,
} from "@beend/shared";
import { z } from "zod";
import { prisma, tenantDb, tenantTransaction } from "../../db.js";
import { HttpError, missing } from "../../errors.js";
import { deviceRoom, type Realtime } from "../../realtime.js";
import { requireActor } from "../auth/service.js";
import { requireAsset } from "./assets.js";
import { videoCatalog } from "./video-scenes.js";
import { managed, settingsFor } from "./service.js";

const logoInput = z.object({ imageUrl: assetUrlSchema.nullable() });

export function contentRoutes(app: FastifyInstance, realtime: Realtime) {
  app.get("/admin/content", async (request) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const db = tenantDb(actor.tenantId);
    const [tenant, local, global] = await Promise.all([
      db.tenant.findUniqueOrThrow({
        where: { id: actor.tenantId },
        select: { logoUrl: true },
      }),
      db.card.findMany({ orderBy: { title: "asc" } }),
      actor.role === "SUPERADMIN"
        ? prisma.card.findMany({
            where: { tenantId: null },
            orderBy: { title: "asc" },
          })
        : [],
    ]);
    return { ...tenant, cards: [...local, ...global].map(managed) };
  });
  app.put("/admin/logo", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { imageUrl } = logoInput.parse(request.body);
    await requireAsset(imageUrl);
    await tenantDb(actor.tenantId).tenant.update({
      where: { id: actor.tenantId },
      data: { logoUrl: imageUrl },
    });
    return reply.code(204).send();
  });
  app.post("/admin/cards", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { global, validFrom, validTo, ...fields } = cardInput.parse(
      request.body,
    );
    if (global && (actor.role !== "SUPERADMIN" || fields.type !== "TIP"))
      throw new HttpError(403, "Somente dicas da Beend podem ser globais.");
    await requireAsset(fields.imageUrl);
    const data = {
      ...fields,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
    };
    const card = global
      ? await prisma.card.create({ data: { ...data, tenantId: null } })
      : await tenantDb(actor.tenantId).card.create({
          data: { ...data, tenantId: actor.tenantId },
        });
    if (!global) realtime.publishContent(actor.tenantId);
    return reply.code(201).send(managed(card));
  });
  app.put("/admin/cards/:id", async (request) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    const { global, validFrom, validTo, ...fields } = cardInput.parse(
      request.body,
    );
    if (global && (actor.role !== "SUPERADMIN" || fields.type !== "TIP"))
      throw new HttpError(403, "Somente dicas da Beend podem ser globais.");
    await requireAsset(fields.imageUrl);
    const data = {
      ...fields,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
    };
    const card = global
      ? await prisma.card.update({ where: { id, tenantId: null }, data })
      : await tenantDb(actor.tenantId).card.update({ where: { id }, data });
    if (!global) realtime.publishContent(actor.tenantId);
    return managed(card);
  });
  app.delete("/admin/cards/:id", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    const { global } = z
      .object({ global: z.enum(["true", "false"]).optional() })
      .parse(request.query);
    if (global === "true") {
      if (actor.role !== "SUPERADMIN")
        throw new HttpError(403, "Você não tem acesso a esta área.");
      await prisma.card.delete({ where: { id, tenantId: null } });
    } else {
      await tenantDb(actor.tenantId).card.delete({ where: { id } });
      realtime.publishContent(actor.tenantId);
    }
    return reply.code(204).send();
  });
  app.get("/admin/panels/:id", async (request): Promise<PanelEditorData> => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    const db = tenantDb(actor.tenantId);
    const panel = await db.device.findFirst({
      where: { id, unitId: actor.unitId, type: "PANEL" },
      include: { config: true },
    });
    if (!panel) missing("Painel indisponível.");
    const [services, feeds] = await Promise.all([
      db.service.findMany({
        where: { unitId: actor.unitId, active: true },
        select: { id: true, name: true },
        orderBy: { stageOrder: "asc" },
      }),
      prisma.feedSource.findMany({
        where: { global: true, active: true },
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      }),
    ]);
    return {
      name: panel.name,
      videoCatalog,
      config: settingsFor(panel.config),
      services,
      categories: [
        ...new Set([
          ...Object.keys(newsTopics),
          ...feeds.map(({ category }) => category),
        ]),
      ],
    };
  });
  app.patch("/admin/panels/:id/news", async (request) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    const input = panelNewsInput.parse(request.body);
    const news = {
      newsMode: input.mode,
      newsCategories:
        input.mode === "AUTO"
          ? newsPresets[input.preset].categories
          : input.categories,
    };
    const saved = await tenantTransaction(actor.tenantId, async (db) => {
      const panel = await db.device.findFirst({
        where: { id, unitId: actor.unitId, type: "PANEL" },
      });
      if (!panel) missing("Painel indisponível.");
      const config = await db.panelConfig.upsert({
        where: { deviceId: id },
        create: {
          ...news,
          tenantId: actor.tenantId,
          deviceId: id,
          state: defaultPanelSettings.state,
        },
        update: news,
      });
      const settings = settingsFor(config);
      if (settings.weights.NEWS > 0) return settings;
      return settingsFor(
        await db.panelConfig.update({
          where: { deviceId: id },
          data: {
            weights: {
              ...settings.weights,
              NEWS: defaultPanelSettings.weights.NEWS,
            },
          },
        }),
      );
    });
    realtime.io.to(deviceRoom(id)).emit("panel.config");
    return saved;
  });
  app.patch("/admin/panels/:id/videos", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    const videos = panelVideoInput.parse(request.body);
    const db = tenantDb(actor.tenantId);
    const panel = await db.device.findFirst({
      where: { id, unitId: actor.unitId, type: "PANEL" },
    });
    if (!panel) missing("Painel indisponível.");
    await db.panelConfig.upsert({
      where: { deviceId: id },
      create: {
        tenantId: actor.tenantId,
        deviceId: id,
        state: defaultPanelSettings.state,
        ...videos,
      },
      update: videos,
    });
    realtime.io.to(deviceRoom(id)).emit("panel.config");
    return reply.code(204).send();
  });
  app.put("/admin/panels/:id", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    const { newsCategories, ...settings } = panelInput.parse(request.body);
    const config = {
      ...settings,
      ...(newsCategories && { newsCategories, newsMode: "AUTO" }),
    };
    const db = tenantDb(actor.tenantId);
    const [panel, count] = await Promise.all([
      db.device.findFirst({
        where: { id, unitId: actor.unitId, type: "PANEL" },
      }),
      db.service.count({
        where: {
          unitId: actor.unitId,
          id: { in: config.serviceIds },
          active: true,
        },
      }),
    ]);
    if (!panel || count !== config.serviceIds.length)
      missing("Painel ou serviço indisponível.");
    await db.panelConfig.upsert({
      where: { deviceId: idSchema.parse(panel.id) },
      create: { ...config, tenantId: actor.tenantId, deviceId: id },
      update: config,
    });
    realtime.io.to(deviceRoom(id)).emit("panel.config");
    if (config.weights.WEATHER > 0)
      void refreshWeather(config)
        .then((updated) => {
          if (updated) realtime.io.to(deviceRoom(id)).emit("panel.content");
        })
        .catch(() =>
          app.log.warn("Weather refresh failed for a configured panel"),
        );
    return reply.code(204).send();
  });
}
