import type { FastifyInstance } from "fastify";
import {
  deviceInput,
  idParams,
  issueInput,
  pairInput,
  readTheme,
  type DeviceLink,
} from "@beend/shared";
import { tenantDb } from "../../db.js";
import { deviceRoom, type Realtime } from "../../realtime.js";
import { requireActor } from "../auth/service.js";
import { issueTicket } from "../queue/service.js";
import { allowance } from "./limits.js";
import { requireDevice } from "./auth.js";
import { deviceRecord, newPairing, pairDevice } from "./service.js";

export function deviceRoutes(app: FastifyInstance, realtime: Realtime) {
  app.get("/devices/links", async (request): Promise<DeviceLink[]> => {
    const actor = await requireActor(request);
    return tenantDb(actor.tenantId).device.findMany({
      where: { unitId: actor.unitId },
      select: { id: true, name: true, type: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
  });

  app.get("/admin/devices", async (request) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const devices = await tenantDb(actor.tenantId).device.findMany({
      where: { unitId: actor.unitId },
      orderBy: { name: "asc" },
    });
    return devices.map(deviceRecord);
  });
  app.get("/admin/devices/allowance", async (request) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const db = tenantDb(actor.tenantId);
    const [limits, kiosks, panels] = await Promise.all([
      db.tenant.findUniqueOrThrow({
        where: { id: actor.tenantId },
        select: { kioskLimit: true, panelLimit: true },
      }),
      db.device.count({ where: { type: "KIOSK" } }),
      db.device.count({ where: { type: "PANEL" } }),
    ]);
    return allowance(limits, kiosks, panels);
  });
  app.post("/admin/devices", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    return reply
      .code(201)
      .send(await newPairing(actor, deviceInput.parse(request.body)));
  });
  app.post("/admin/devices/:id/pairing", async (request) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    const pairing = await newPairing(actor, { id });
    realtime.io.in(deviceRoom(id)).disconnectSockets(true);
    return pairing;
  });
  app.patch("/admin/devices/:id", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    const data = deviceInput.pick({ name: true }).parse(request.body);
    await tenantDb(actor.tenantId).device.update({
      where: { id, unitId: actor.unitId },
      data,
    });
    return reply.code(204).send();
  });
  app.delete("/admin/devices/:id", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    await tenantDb(actor.tenantId).device.delete({
      where: { id, unitId: actor.unitId },
    });
    realtime.io.in(deviceRoom(id)).disconnectSockets(true);
    return reply.code(204).send();
  });

  app.post(
    "/devices/:id/pair",
    { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } },
    async (request) => {
      const { id } = idParams.parse(request.params);
      const { code } = pairInput.parse(request.body);
      return pairDevice(id, code);
    },
  );

  app.get("/kiosk/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    const { scope, db, tenant } = await requireDevice(
      request.headers.authorization,
      id,
      "KIOSK",
    );
    const [unit, services] = await Promise.all([
      db.unit.findUniqueOrThrow({
        where: { id: scope.unitId },
        select: { name: true },
      }),
      db.service.findMany({
        where: { unitId: scope.unitId, active: true },
        select: { id: true, name: true, callMode: true, stageOrder: true },
        orderBy: [{ stageOrder: "asc" }, { name: "asc" }],
      }),
    ]);
    return { unitName: unit.name, services, theme: readTheme(tenant.theme) };
  });
  app.post(
    "/kiosk/:id/tickets",
    { config: { rateLimit: { max: 24, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { id } = idParams.parse(request.params);
      const { scope } = await requireDevice(
        request.headers.authorization,
        id,
        "KIOSK",
      );
      const { serviceId, priority, requestId } = issueInput.parse(request.body);
      const { receipt, change } = await issueTicket(scope, {
        serviceId,
        priority,
        requestId,
      });
      if (change) realtime.publish(scope, change);
      return reply.code(201).send(receipt);
    },
  );
}
