import { publicTokenSchema, readTheme, type TrackingData } from "@beend/shared";
import { prisma, tenantDb } from "../../db.js";
import { HttpError, missing } from "../../errors.js";
import { dateFor, position } from "../queue/service.js";

export async function resolveTracking(token: string) {
  publicTokenSchema.parse(token);
  // The opaque capability resolves the tenant before reading any queue data.
  const reference = await prisma.ticket.findUnique({
    where: { publicToken: token },
    select: { tenantId: true, id: true },
  });
  if (!reference) missing("Esta senha não foi encontrada.");
  const db = tenantDb(reference.tenantId);
  const [ticket, tenant] = await Promise.all([
    db.ticket.findUnique({ where: { id: reference.id, publicToken: token } }),
    db.tenant.findUniqueOrThrow({
      where: { id: reference.tenantId },
      select: {
        timeZone: true,
        resetTime: true,
        theme: true,
        suspendedAt: true,
      },
    }),
  ]);
  if (!ticket) missing("Esta senha não foi encontrada.");
  if (tenant.suspendedAt)
    throw new HttpError(403, "O acompanhamento desta empresa está suspenso.");
  const scope = {
    tenantId: reference.tenantId,
    unitId: ticket.unitId,
    timeZone: tenant.timeZone,
    resetTime: tenant.resetTime,
  };
  if (ticket.businessDate !== dateFor(scope))
    throw new HttpError(410, "O acompanhamento desta senha expirou.");
  return { db, ticket, scope, theme: readTheme(tenant.theme) };
}

export async function trackingData(token: string): Promise<TrackingData> {
  const { db, ticket, scope, theme } = await resolveTracking(token);
  const [service, unit, counter] = await Promise.all([
    db.service.findUniqueOrThrow({
      where: { id: ticket.serviceId, unitId: scope.unitId },
    }),
    db.unit.findUniqueOrThrow({
      where: { id: scope.unitId },
      select: { name: true },
    }),
    ticket.counterId && ["CALLED", "IN_SERVICE"].includes(ticket.status)
      ? db.counter.findUnique({
          where: { id: ticket.counterId, unitId: scope.unitId },
          select: { number: true },
        })
      : null,
  ]);
  return {
    theme,
    code: ticket.code,
    status: ticket.status,
    unitName: unit.name,
    service: { id: service.id, name: service.name },
    peopleAhead: await position(db, scope, ticket, service),
    counterNumber: counter?.number,
  };
}
