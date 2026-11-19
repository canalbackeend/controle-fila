import type { FastifyInstance } from "fastify";
import { hash } from "bcryptjs";
import {
  counterInput,
  themeSchema,
  customTemplateInput,
  idParams,
  recoverShiftInput,
  serviceInput,
  templateInput,
  tenantSettings,
  userInput,
  userUpdate,
} from "@beend/shared";
import { tenantDb } from "../../db.js";
import { HttpError } from "../../errors.js";
import type { Realtime } from "../../realtime.js";
import { requireActor } from "../auth/service.js";
import {
  configureServices,
  manageUsers,
  updateTenantSettings,
  userFields,
  validatePrefixes,
} from "./service.js";
import { findTemplate, saveTemplate, templateCatalog } from "./templates.js";
import { openShifts, recoverShift } from "../attendant/service.js";

export function adminRoutes(app: FastifyInstance, realtime: Realtime) {
  app.put("/admin/theme", async (request) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const theme = themeSchema.parse(request.body);
    await tenantDb(actor.tenantId).tenant.update({
      where: { id: actor.tenantId },
      data: { theme },
    });
    realtime.publishTheme(actor.tenantId, theme);
    return theme;
  });

  app.get("/admin", async (request) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const db = tenantDb(actor.tenantId);
    const [tenant, unit, services, counters, users, templates] =
      await Promise.all([
        db.tenant.findUniqueOrThrow({ where: { id: actor.tenantId } }),
        db.unit.findUniqueOrThrow({ where: { id: actor.unitId } }),
        db.service.findMany({
          where: { unitId: actor.unitId },
          orderBy: [{ stageOrder: "asc" }, { name: "asc" }],
        }),
        db.counter.findMany({
          where: { unitId: actor.unitId },
          orderBy: { number: "asc" },
        }),
        db.user.findMany({ select: userFields, orderBy: { name: "asc" } }),
        templateCatalog(),
      ]);
    return {
      tenant,
      unit,
      services,
      counters,
      users,
      templates,
    };
  });

  app.put("/admin/settings", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { unitName, ...data } = tenantSettings.parse(request.body);
    await updateTenantSettings(actor, data, unitName);
    return reply.code(204).send();
  });

  app.post("/admin/services", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const data = serviceInput.parse(request.body);
    const service = await configureServices(actor, async (db) => {
      await validatePrefixes(db, actor.unitId, data);
      return db.service.create({
        data: { ...data, tenantId: actor.tenantId, unitId: actor.unitId },
      });
    });
    return reply.code(201).send(service);
  });
  app.put("/admin/services/:id", async (request) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    const data = serviceInput.parse(request.body);
    return configureServices(actor, async (db) => {
      await db.service.findUniqueOrThrow({
        where: { id, unitId: actor.unitId },
      });
      await validatePrefixes(db, actor.unitId, data, id);
      return db.service.update({ where: { id, unitId: actor.unitId }, data });
    });
  });
  app.delete("/admin/services/:id", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    await tenantDb(actor.tenantId).service.update({
      where: { id, unitId: actor.unitId },
      data: { active: false },
    });
    return reply.code(204).send();
  });

  app.post("/admin/counters", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const data = counterInput.parse(request.body);
    const counter = await tenantDb(actor.tenantId).counter.create({
      data: { ...data, unitId: actor.unitId, tenantId: actor.tenantId },
    });
    return reply.code(201).send(counter);
  });
  app.put("/admin/counters/:id", async (request) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    return tenantDb(actor.tenantId).counter.update({
      where: { id, unitId: actor.unitId },
      data: counterInput.parse(request.body),
    });
  });
  app.delete("/admin/counters/:id", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    await tenantDb(actor.tenantId).counter.update({
      where: { id, unitId: actor.unitId },
      data: { active: false },
    });
    return reply.code(204).send();
  });
  app.get("/admin/shifts", async (request) =>
    openShifts(await requireActor(request, ["ADMIN", "SUPERADMIN"])),
  );
  app.post("/admin/shifts/:id/recover", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    const change = await recoverShift(
      actor,
      id,
      recoverShiftInput.parse(request.body),
    );
    if (change) realtime.publish(actor, change);
    realtime.publishShift(actor);
    return reply.code(204).send();
  });

  app.post("/admin/users", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { password, ...fields } = userInput.parse(request.body);
    const user = await manageUsers(actor).create({
      data: {
        ...fields,
        tenantId: actor.tenantId,
        passwordHash: await hash(password, 12),
      },
      select: userFields,
    });
    return reply.code(201).send(user);
  });
  app.put("/admin/users/:id", async (request) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    const { password, ...fields } = userUpdate.parse(request.body);
    if (id === actor.id)
      throw new HttpError(
        409,
        "Peça a outro administrador para alterar sua conta.",
      );
    const passwordHash = password ? await hash(password, 12) : undefined;
    const { user, revoke } = await configureServices(actor, async (db) => {
      const where = { id, role: { not: "SUPERADMIN" as const } };
      const current = await db.user.findUniqueOrThrow({
        where,
        select: { role: true, active: true, email: true },
      });
      const revoke =
        Boolean(passwordHash) ||
        current.role !== fields.role ||
        current.active !== fields.active ||
        current.email !== fields.email;
      const user = await db.user.update({
        where,
        data: {
          ...fields,
          passwordHash,
          credentialsChangedAt: revoke ? new Date() : undefined,
        },
        select: userFields,
      });
      return { user, revoke };
    });
    if (revoke) realtime.closeAccountSessions(actor.tenantId, id);
    return user;
  });
  app.delete("/admin/users/:id", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    if (id === actor.id)
      throw new HttpError(409, "Você não pode desativar sua própria conta.");
    await configureServices(actor, (db) =>
      db.user.update({
        where: { id, role: { not: "SUPERADMIN" } },
        data: { active: false, credentialsChangedAt: new Date() },
        select: { id: true },
      }),
    );
    realtime.closeAccountSessions(actor.tenantId, id);
    return reply.code(204).send();
  });

  app.post("/admin/template", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { templateId } = templateInput.parse(request.body);
    const template = await findTemplate(templateId);
    if (!template) throw new HttpError(404, "Modelo não encontrado.");
    await configureServices(actor, async (db) => {
      const where = { unitId: actor.unitId };
      if (
        (await db.service.count({ where })) ||
        (await db.counter.count({ where }))
      ) {
        throw new HttpError(
          409,
          "Aplique o modelo antes de criar serviços ou guichês.",
        );
      }
      const scope = { unitId: actor.unitId, tenantId: actor.tenantId };
      await db.service.createMany({
        data: template.services.map((service) => ({
          ...service,
          ...scope,
        })),
      });
      await db.counter.createMany({
        data: template.counters.map((counter) => ({
          ...counter,
          ...scope,
        })),
      });
    });
    return reply.code(204).send();
  });

  app.post("/admin/templates", async (request, reply) => {
    const actor = await requireActor(request, ["SUPERADMIN"]);
    const { name } = customTemplateInput.parse(request.body);
    return reply.code(201).send(await saveTemplate(actor, name));
  });
}
