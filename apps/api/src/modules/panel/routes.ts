import type { FastifyInstance } from "fastify";
import {
  idParams,
  readTheme,
  type PanelCall,
  type PanelData,
} from "@beend/shared";
import { panelContent, settingsFor } from "../content/service.js";
import { requireDevice } from "../devices/auth.js";
import { nameFor } from "../queue/service.js";

export function panelRoutes(app: FastifyInstance) {
  app.get("/panel/:id", async (request): Promise<PanelData> => {
    const { id } = idParams.parse(request.params);
    const { scope, db, tenant } = await requireDevice(
      request.headers.authorization,
      id,
      "PANEL",
    );
    const [unit, saved] = await Promise.all([
      db.unit.findUniqueOrThrow({
        where: { id: scope.unitId },
        select: { name: true },
      }),
      db.panelConfig.findUnique({ where: { deviceId: id } }),
    ]);
    const config = settingsFor(saved);
    const [events, services, counters, content] = await Promise.all([
      db.ticketEvent.findMany({
        where: {
          unitId: scope.unitId,
          type: { in: ["CALLED", "RECALLED"] },
          ...(config.serviceIds.length
            ? { fromServiceId: { in: config.serviceIds } }
            : {}),
        },
        orderBy: [{ at: "desc" }, { id: "desc" }],
        take: 5,
        select: {
          id: true,
          ticketId: true,
          fromServiceId: true,
          counterId: true,
          at: true,
          type: true,
          ticket: { select: { code: true, customerName: true } },
        },
      }),
      db.service.findMany({
        where: { unitId: scope.unitId },
        select: { id: true, callMode: true },
      }),
      db.counter.findMany({
        where: { unitId: scope.unitId },
        select: { id: true, name: true },
      }),
      panelContent(tenant.id, config),
    ]);
    const calls = events.flatMap((event): PanelCall[] => {
      const service = services.find(({ id }) => id === event.fromServiceId);
      const counter = counters.find(({ id }) => id === event.counterId);
      if (!service || !counter) return [];
      return [
        {
          id: event.id,
          ticketId: event.ticketId,
          serviceId: service.id,
          code: event.ticket.code,
          displayName: nameFor(service, event.ticket),
          counter: counter.name,
          isRecall: event.type === "RECALLED",
          at: event.at.toISOString(),
        },
      ];
    });
    return {
      unitName: unit.name,
      theme: readTheme(tenant.theme),
      timeZone: scope.timeZone,
      logoUrl: tenant.logoUrl ?? undefined,
      config,
      calls,
      ...content,
    };
  });
}
