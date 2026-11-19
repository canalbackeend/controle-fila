import type {
  Actor,
  AttendantState,
  OpenShift,
  RecoverShiftInput,
  ShiftInput,
  ShiftServicesInput,
} from "@beend/shared";
import { tenantDb, type TenantTransaction } from "../../db.js";
import { HttpError, missing } from "../../errors.js";
import { configureServices } from "../admin/service.js";
import {
  activeStatuses,
  dateFor,
  nameFor,
  queueStats,
  recordTicketEvent,
  ticketSummary,
} from "../queue/service.js";

export async function attendantState(actor: Actor): Promise<AttendantState> {
  const db = tenantDb(actor.tenantId);
  const unitId = actor.unitId;
  const [services, unitCounters, session, stats] = await Promise.all([
    db.service.findMany({
      where: { unitId },
      orderBy: [{ stageOrder: "asc" }, { name: "asc" }],
    }),
    db.counter.findMany({
      where: { unitId, active: true },
      select: {
        id: true,
        name: true,
        number: true,
        sessions: {
          where: { unitId, endedAt: null },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { number: "asc" },
    }),
    db.counterSession.findFirst({
      where: { unitId, userId: actor.id, endedAt: null },
      include: { counter: { select: { name: true } } },
    }),
    queueStats(actor),
  ]);
  const counters = unitCounters.map(({ sessions, ...counter }) => ({
    ...counter,
    occupied: sessions.length > 0,
  }));
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

async function assertShiftServices(
  db: TenantTransaction,
  unitId: string,
  serviceIds: string[],
) {
  const count = await db.service.count({
    where: { id: { in: serviceIds }, unitId, active: true },
  });
  if (count !== serviceIds.length)
    missing("Um dos serviços selecionados está indisponível.");
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
    const [counter] = await Promise.all([
      db.counter.findFirst({
        where: { id: input.counterId, unitId, active: true },
      }),
      assertShiftServices(db, unitId, input.serviceIds),
    ]);
    if (!counter) missing("Guichê indisponível.");
    await db.counterSession.create({
      data: { unitId, tenantId, userId: actor.id, ...input },
    });
  });
}

export function updateShiftServices(
  actor: Actor,
  { shiftId, serviceIds }: ShiftServicesInput,
) {
  return configureServices(actor, async (db) => {
    const where = {
      id: shiftId,
      unitId: actor.unitId,
      userId: actor.id,
      endedAt: null,
    };
    if (!(await db.counterSession.findFirst({ where, select: { id: true } })))
      missing(
        "Turno ativo não encontrado. Atualize o Atendimento e tente novamente.",
      );
    await assertShiftServices(db, actor.unitId, serviceIds);
    await db.counterSession.update({ where, data: { serviceIds } });
  });
}

export async function endShift(actor: Actor) {
  return configureServices(actor, async (db) => {
    const session = await db.counterSession.findFirst({
      where: { unitId: actor.unitId, userId: actor.id, endedAt: null },
    });
    if (!session) return false;
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
    return true;
  });
}

export async function openShifts(actor: Actor): Promise<OpenShift[]> {
  const db = tenantDb(actor.tenantId);
  const sessions = await db.counterSession.findMany({
    where: { unitId: actor.unitId, endedAt: null },
    select: { id: true, counterId: true, user: { select: { name: true } } },
  });
  if (!sessions.length) return [];
  const [tickets, services] = await Promise.all([
    db.ticket.findMany({
      where: {
        unitId: actor.unitId,
        sessionId: { in: sessions.map(({ id }) => id) },
        status: { in: [...activeStatuses] },
      },
      select: {
        id: true,
        code: true,
        status: true,
        sessionId: true,
        businessDate: true,
        serviceId: true,
      },
    }),
    db.service.findMany({
      where: { unitId: actor.unitId, active: true },
      select: { id: true },
    }),
  ]);
  const bySession = new Map(
    tickets.map((ticket) => [ticket.sessionId, ticket]),
  );
  const activeServices = new Set(services.map(({ id }) => id));
  const today = dateFor(actor);
  return sessions.map(({ id, counterId, user }) => {
    const ticket = bySession.get(id);
    return {
      id,
      counterId,
      attendant: user.name,
      ticket:
        ticket && (ticket.status === "CALLED" || ticket.status === "IN_SERVICE")
          ? {
              id: ticket.id,
              code: ticket.code,
              status: ticket.status,
              canRequeue:
                ticket.businessDate === today &&
                activeServices.has(ticket.serviceId),
            }
          : null,
    };
  });
}

export function recoverShift(
  actor: Actor,
  id: string,
  input: RecoverShiftInput,
) {
  return configureServices(actor, async (db) => {
    const shift = await db.counterSession.findFirst({
      where: { id, unitId: actor.unitId },
      select: { id: true, counterId: true, endedAt: true },
    });
    if (!shift) missing("Turno não encontrado nesta unidade.");
    if (shift.endedAt) throw new HttpError(409, "Este turno já foi encerrado.");

    const ticket = await db.ticket.findFirst({
      where: {
        unitId: actor.unitId,
        sessionId: shift.id,
        status: { in: [...activeStatuses] },
      },
    });
    const resolution = input.ticket;
    if (ticket?.id !== resolution?.id || ticket?.status !== resolution?.status)
      throw new HttpError(
        409,
        "A senha ativa mudou. Confira o turno e tente novamente.",
      );

    const now = new Date();
    const requeue = resolution?.action === "REQUEUE";
    if (
      ticket &&
      requeue &&
      (ticket.businessDate !== dateFor(actor, now) ||
        !(await db.service.findFirst({
          where: { id: ticket.serviceId, unitId: actor.unitId, active: true },
          select: { id: true },
        })))
    )
      throw new HttpError(
        409,
        "Esta senha não pode voltar à fila. Confira o turno e selecione outra ação.",
      );

    await db.counterSession.update({
      where: { id: shift.id },
      data: { endedAt: now },
    });
    if (!ticket) return;

    const changed = await db.ticket.update({
      where: { id: ticket.id },
      data: requeue
        ? {
            status: "WAITING",
            queuedAt: now,
            sessionId: null,
            counterId: null,
            targetCounterId: null,
            calledAt: null,
            startedAt: null,
          }
        : { status: "CANCELED", finishedAt: now },
    });
    const type = requeue ? "QUEUED" : "CANCELED";
    await recordTicketEvent(db, actor, changed, type, {
      userId: actor.id,
      counterId: shift.counterId,
      fromServiceId: ticket.serviceId,
      toServiceId: requeue ? ticket.serviceId : undefined,
    });
    return { ticket: changed, type } as const;
  });
}
