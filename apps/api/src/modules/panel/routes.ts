import type { FastifyInstance } from "fastify";
import {
  defaultPanelSettings,
  idParams,
  type PanelCall,
  type PanelData,
  type PanelSettings,
} from "@beend/shared";
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
    const config: PanelSettings = saved
      ? {
          serviceIds: saved.serviceIds,
          weights: {
            ...defaultPanelSettings.weights,
            ...(saved.weights as PanelSettings["weights"]),
          },
          city: saved.city,
          newsCategories: saved.newsCategories,
          cardSeconds: saved.cardSeconds,
          callDisplaySeconds: saved.callDisplaySeconds,
          ticker: saved.ticker,
        }
      : defaultPanelSettings;
    const [events, services, counters] = await Promise.all([
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
      timeZone: scope.timeZone,
      logoUrl: tenant.logoUrl ?? undefined,
      config,
      calls,
      cards: [],
    };
  });
}
