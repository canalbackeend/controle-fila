import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import type { PanelCall, TenantTheme } from "@beend/shared";
import { tenantDb } from "./db.js";
import { sessionActor, sessionCookie } from "./modules/auth/service.js";
import { resolveTracking } from "./modules/tracking/service.js";
import { deviceIdentity } from "./modules/devices/auth.js";
import {
  dateFor,
  queueStats,
  ticketSummary,
  type QueueChange,
  type QueueScope,
} from "./modules/queue/service.js";

const unitRoom = (scope: Pick<QueueScope, "tenantId" | "unitId">) =>
  `unit:${scope.tenantId}:${scope.unitId}`;
const trackingRoom = (scope: QueueScope, date: string) =>
  `tracking:${scope.tenantId}:${scope.unitId}:${date}`;
const ticketRoom = (token: string) => `ticket:${token}`;
const accountRoom = (tenantId: string, userId: string) =>
  `account:${tenantId}:${userId}`;
const themeRoom = (tenantId: string) => `theme:${tenantId}`;
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
      if (auth.publicToken) {
        if (typeof auth.publicToken !== "string")
          return next(new Error("Senha indisponível."));
        const { scope, ticket } = await resolveTracking(auth.publicToken);
        await socket.join([
          ticketRoom(auth.publicToken),
          trackingRoom(scope, ticket.businessDate),
          themeRoom(scope.tenantId),
        ]);
        return next();
      }
      if (auth.deviceToken) {
        const device = await deviceIdentity(auth.deviceToken);
        if (!device || device.unit.tenant.suspendedAt)
          return next(new Error("Dispositivo não autorizado."));
        socket.data.deviceId = device.id;
        await socket.join([deviceRoom(device.id), themeRoom(device.tenantId)]);
        return next();
      }
      const cookies = app.parseCookie(socket.request.headers.cookie ?? "");
      const actor = await sessionActor(
        cookies[sessionCookie],
        app.unsignCookie.bind(app),
      );
      if (!actor || actor.mustChangePassword)
        return next(new Error("Sessão não autorizada."));
      await socket.join([
        unitRoom(actor),
        themeRoom(actor.tenantId),
        accountRoom(actor.tenantId, actor.id),
      ]);
      return next();
    } catch {
      return next(new Error("Conexão indisponível."));
    }
  });

  async function publish(scope: QueueScope, change: QueueChange) {
    const { ticket, type, counterName, displayName, eventId, eventTime } =
      change;
    const room = io.to(unitRoom(scope));
    const date = dateFor(scope);
    io.to(trackingRoom(scope, date)).emit("queue.changed");
    if (ticket.businessDate === date) {
      io.to(ticketRoom(ticket.publicToken)).emit("ticket.updated", {
        status: ticket.status,
      });
    }
    room.emit(
      type === "ISSUED" ? "ticket.issued" : "ticket.updated",
      ticketSummary(ticket),
    );
    if ((type === "CALLED" || type === "RECALLED") && eventId && eventTime) {
      const call: PanelCall = {
        id: eventId,
        ticketId: ticket.id,
        code: ticket.code,
        counter: counterName ?? "",
        displayName,
        serviceId: ticket.serviceId,
        isRecall: type === "RECALLED",
        at: eventTime.toISOString(),
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
    closeAccountSessions: (tenantId: string, userId: string) => {
      const room = io.in(accountRoom(tenantId, userId));
      room.emit("account.credentials");
      room.disconnectSockets(true);
    },
    suspendTenant: (tenantId: string) => {
      const room = io.in(themeRoom(tenantId));
      room.emit("tenant.suspended");
      room.disconnectSockets(true);
    },
    publishTheme: (tenantId: string, theme: TenantTheme) =>
      io.to(themeRoom(tenantId)).emit("tenant.theme", theme),
    publishShift: (scope: QueueScope) =>
      io.to(unitRoom(scope)).emit("shift.changed"),
    publish: (scope: QueueScope, change: QueueChange) => {
      void publish(scope, change).catch(() =>
        app.log.error("Could not publish queue change"),
      );
    },
  };
}

export type Realtime = ReturnType<typeof attachRealtime>;
