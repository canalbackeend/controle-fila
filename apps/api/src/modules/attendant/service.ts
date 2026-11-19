import type { Actor, AttendantState, ShiftInput } from "@beend/shared";
import { tenantDb } from "../../db.js";
import { HttpError, missing } from "../../errors.js";
import { configureServices } from "../admin/service.js";
import {
  activeStatuses,
  dateFor,
  nameFor,
  queueStats,
  ticketSummary,
} from "../queue/service.js";

export async function attendantState(actor: Actor): Promise<AttendantState> {
  const db = tenantDb(actor.tenantId);
  const unitId = actor.unitId;
  const [services, counters, session, stats] = await Promise.all([
    db.service.findMany({
      where: { unitId },
      orderBy: [{ stageOrder: "asc" }, { name: "asc" }],
    }),
    db.counter.findMany({
      where: { unitId, active: true },
      select: { id: true, name: true, number: true },
      orderBy: { number: "asc" },
    }),
    db.counterSession.findFirst({
      where: { unitId, userId: actor.id, endedAt: null },
      include: { counter: { select: { name: true } } },
    }),
    queueStats(actor),
  ]);
  const options = services
    .filter(({ active }) => active)
    .map(({ id, name, stageOrder, callMode }) => ({
      id,
      name,
      stageOrder,
      callMode,
    }));
  if (!session)
    return {
      services: options,
      counters,
      session: null,
      active: null,
      waiting: [],
      stats,
    };
  const [active, waiting] = await Promise.all([
    db.ticket.findFirst({
      where: {
        unitId,
        sessionId: session.id,
        status: { in: [...activeStatuses] },
      },
    }),
    db.ticket.findMany({
      where: {
        unitId,
        serviceId: { in: session.serviceIds },
        businessDate: dateFor(actor),
        status: "WAITING",
        OR: [{ targetCounterId: null }, { targetCounterId: session.counterId }],
      },
      orderBy: [{ queuedAt: "asc" }, { id: "asc" }],
      take: 100,
    }),
  ]);
  const activeService = services.find(({ id }) => id === active?.serviceId);
  return {
    services: options,
    counters,
    stats: stats.filter(({ serviceId }) =>
      session.serviceIds.includes(serviceId),
    ),
    session: {
      id: session.id,
      counterId: session.counterId,
      counterName: session.counter.name,
      serviceIds: session.serviceIds,
    },
    active: active
      ? ticketSummary(
          active,
          activeService ? nameFor(activeService, active) : undefined,
        )
      : null,
    waiting: waiting.map((ticket) => ticketSummary(ticket)),
  };
}

export async function startShift(actor: Actor, input: ShiftInput) {
  await configureServices(actor, async (db) => {
    const { unitId, tenantId } = actor;
    const session = await db.counterSession.findFirst({
      where: {
        unitId,
        endedAt: null,
        OR: [{ counterId: input.counterId }, { userId: actor.id }],
      },
    });
    if (session)
      throw new HttpError(
        409,
        session.userId === actor.id
          ? "Encerre o turno atual antes de iniciar outro."
          : "Este guichê está em uso.",
      );
    const [counter, services] = await Promise.all([
      db.counter.findFirst({
        where: { id: input.counterId, unitId, active: true },
      }),
      db.service.count({
        where: { id: { in: input.serviceIds }, unitId, active: true },
      }),
    ]);
    if (!counter || services !== input.serviceIds.length)
      missing("Guichê ou serviço indisponível.");
    await db.counterSession.create({
      data: { unitId, tenantId, userId: actor.id, ...input },
    });
  });
}

export async function endShift(actor: Actor) {
  await configureServices(actor, async (db) => {
    const session = await db.counterSession.findFirst({
      where: { unitId: actor.unitId, userId: actor.id, endedAt: null },
    });
    if (!session) return;
    if (
      await db.ticket.count({
        where: { sessionId: session.id, status: { in: [...activeStatuses] } },
      })
    ) {
      throw new HttpError(
        409,
        "Conclua o atendimento atual antes de encerrar o turno.",
      );
    }
    await db.counterSession.update({
      where: { id: session.id },
      data: { endedAt: new Date() },
    });
  });
}
