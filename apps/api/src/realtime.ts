import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import type { PanelCall } from "@beend/shared";
import { tenantDb } from "./db.js";
import { sessionActor, sessionCookie } from "./modules/auth/service.js";
import { deviceIdentity } from "./modules/devices/auth.js";
import {
  queueStats,
  ticketSummary,
  type QueueChange,
  type QueueScope,
} from "./modules/queue/service.js";

const unitRoom = (scope: Pick<QueueScope, "tenantId" | "unitId">) =>
  `unit:${scope.tenantId}:${scope.unitId}`;
export const deviceRoom = (id: string) => `panel:${id}`;

export function attachRealtime(app: FastifyInstance, origin: string) {
  const io = new Server(app.server, {
    allowRequest: (request, finish) =>
      finish(
        null,
        !request.headers.origin || request.headers.origin === origin,
      ),
    serveClient: false,
    maxHttpBufferSize: 8192,
  });
  app.addHook("preClose", async () => {
    io.disconnectSockets(true);
    io.engine.close();
  });
  io.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth;
      if (auth.deviceToken) {
        const device = await deviceIdentity(auth.deviceToken);
        if (!device) return next(new Error("Dispositivo não autorizado."));
        socket.data.deviceId = device.id;
        await socket.join(deviceRoom(device.id));
        return next();
      }
      const cookies = app.parseCookie(socket.request.headers.cookie ?? "");
      const actor = await sessionActor(
        cookies[sessionCookie],
        app.unsignCookie.bind(app),
      );
      if (!actor) return next(new Error("Sessão não autorizada."));
      await socket.join(unitRoom(actor));
      return next();
    } catch {
      return next(new Error("Conexão indisponível."));
    }
  });

  async function publish(scope: QueueScope, change: QueueChange) {
    const { ticket, type, counterName, displayName } = change;
    const room = io.to(unitRoom(scope));
    room.emit(
      type === "ISSUED" ? "ticket.issued" : "ticket.updated",
      ticketSummary(ticket),
    );
    if (type === "CALLED" || type === "RECALLED") {
      const call: PanelCall = {
        id: randomUUID(),
        ticketId: ticket.id,
        code: ticket.code,
        counter: counterName ?? "",
        displayName,
        serviceId: ticket.serviceId,
        isRecall: type === "RECALLED",
        at: new Date().toISOString(),
      };
      room.emit("ticket.called", { ...call, displayName: undefined });
      const panels = await tenantDb(scope.tenantId).device.findMany({
        where: {
          unitId: scope.unitId,
          type: "PANEL",
          tokenHash: { not: null },
        },
        select: { id: true, config: { select: { serviceIds: true } } },
      });
      const destinations = panels
        .filter(
          ({ config }) =>
            !config?.serviceIds.length ||
            config.serviceIds.includes(ticket.serviceId),
        )
        .map(({ id }) => deviceRoom(id));
      if (destinations.length) io.to(destinations).emit("ticket.called", call);
    }
    room.emit("queue.stats", await queueStats(scope));
  }

  return {
    io,
    publish: (scope: QueueScope, change: QueueChange) => {
      void publish(scope, change).catch(() =>
        app.log.error("Could not publish queue change"),
      );
    },
  };
}

export type Realtime = ReturnType<typeof attachRealtime>;
