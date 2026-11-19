import { randomBytes } from "node:crypto";
import type { Prisma, Service, Ticket } from "@prisma/client";
import {
  businessDate,
  compareQueueOrder,
  pickNextTicket,
  shortCustomerName,
  type Actor,
  type IssueInput,
  type IssuedTicket,
  type QueueStat,
  type TicketAction,
  type TicketSummary,
} from "@beend/shared";
import {
  tenantDb,
  tenantTransaction,
  type TenantTransaction,
} from "../../db.js";
import { HttpError, missing } from "../../errors.js";
import { configureServices } from "../admin/service.js";

export type QueueScope = Pick<
  Actor,
  "tenantId" | "unitId" | "timeZone" | "resetTime"
>;
type QueueDb = TenantTransaction;
type ChangeType = Prisma.TicketEventUncheckedCreateInput["type"];
export type QueueChange = {
  ticket: Ticket;
  type: ChangeType;
  counterName?: string;
  displayName?: string;
  eventId?: string;
  eventTime?: Date;
};
export const activeStatuses = ["CALLED", "IN_SERVICE"] as const;

export function dateFor(scope: QueueScope, now = new Date()) {
  return businessDate(now, scope.timeZone, scope.resetTime);
}

export function ticketSummary(
  ticket: Ticket,
  displayName?: string,
): TicketSummary {
  const {
    id,
    code,
    priority,
    status,
    serviceId,
    queuedAt,
    issuedAt,
    targetCounterId,
  } = ticket;
  return {
    id,
    code,
    priority,
    status,
    serviceId,
    queuedAt: queuedAt.toISOString(),
    issuedAt: issuedAt.toISOString(),
    targetCounterId,
    displayName,
  };
}

export function nameFor(
  service: Pick<Service, "callMode">,
  ticket: Pick<Ticket, "customerName">,
) {
  return service.callMode === "NAME"
    ? shortCustomerName(ticket.customerName)
    : undefined;
}

async function event(
  db: QueueDb,
  scope: QueueScope,
  ticket: Ticket,
  type: ChangeType,
  context: Partial<
    Pick<
      Prisma.TicketEventUncheckedCreateInput,
      "userId" | "counterId" | "fromServiceId" | "toServiceId"
    >
  > = {},
) {
  return db.ticketEvent.create({
    data: {
      tenantId: scope.tenantId,
      unitId: scope.unitId,
      ticketId: ticket.id,
      type,
      ...context,
    },
  });
}

function sequenceKey(scope: QueueScope, serviceId: string, date: string) {
  return {
    tenantId: scope.tenantId,
    unitId: scope.unitId,
    serviceId,
    businessDate: date,
  };
}

export async function position(
  db: QueueDb,
  scope: QueueScope,
  ticket: Ticket,
  service: Service,
) {
  if (ticket.status !== "WAITING") return 0;
  const [sequence, tickets] = await Promise.all([
    db.queueSequence.findUnique({
      where: {
        tenantId_unitId_serviceId_businessDate: sequenceKey(
          scope,
          service.id,
          ticket.businessDate,
        ),
      },
    }),
    db.ticket.findMany({
      where: {
        unitId: scope.unitId,
        serviceId: ticket.serviceId,
        businessDate: ticket.businessDate,
        status: "WAITING",
        ...(ticket.targetCounterId
          ? {
              OR: [
                { targetCounterId: null },
                { targetCounterId: ticket.targetCounterId },
              ],
            }
          : {}),
      },
      select: { id: true, priority: true, queuedAt: true },
    }),
  ]);
  const queues = { NORMAL: [], PREFERENTIAL: [], PRIORITY80: [] } as Record<
    Ticket["priority"],
    typeof tickets
  >;
  for (const item of tickets.sort(compareQueueOrder))
    queues[item.priority].push(item);
  const offsets = { NORMAL: 0, PREFERENTIAL: 0, PRIORITY80: 0 };
  let turn = sequence?.turn ?? 0;
  for (let index = 0; index < tickets.length; index++) {
    const candidates = (Object.keys(queues) as Ticket["priority"][]).flatMap(
      (priority) => queues[priority][offsets[priority]] ?? [],
    );
    const next = pickNextTicket(candidates, service, turn);
    if (!next.ticket || next.ticket.id === ticket.id) return index;
    offsets[next.ticket.priority]++;
    turn = next.nextTurn;
  }
  return 0;
}

export function issueTicket(
  scope: QueueScope,
  input: IssueInput,
  userId?: string,
): Promise<{ receipt: IssuedTicket; change?: QueueChange }> {
  return configureServices(scope, async (db) => {
    const now = new Date();
    const date = dateFor(scope, now);
    if (input.requestId) {
      const existing = await db.ticket.findUnique({
        where: {
          tenantId_unitId_issueKey: {
            tenantId: scope.tenantId,
            unitId: scope.unitId,
            issueKey: input.requestId,
          },
        },
      });
      if (existing) {
        if (
          existing.issuedServiceId !== input.serviceId ||
          existing.priority !== input.priority
        ) {
          throw new HttpError(409, "A referência de emissão já está em uso.");
        }
        const [unit, service] = await Promise.all([
          db.unit.findUniqueOrThrow({
            where: { id: scope.unitId },
            select: { name: true },
          }),
          db.service.findUniqueOrThrow({
            where: { id: existing.issuedServiceId },
          }),
        ]);
        return {
          receipt: {
            ...ticketSummary(existing),
            publicToken: existing.publicToken,
            unitName: unit.name,
            timeZone: scope.timeZone,
            serviceName: service.name,
            peopleAhead:
              existing.serviceId === service.id
                ? await position(db, scope, existing, service)
                : 0,
          },
        };
      }
    }
    const service = await db.service.findFirst({
      where: { id: input.serviceId, unitId: scope.unitId, active: true },
    });
    if (!service) missing("Serviço indisponível.");
    const unit = await db.unit.findUniqueOrThrow({
      where: { id: scope.unitId },
      select: { name: true },
    });
    const key = sequenceKey(scope, service.id, date);
    const count = await db.queueSequence.upsert({
      where: { tenantId_unitId_serviceId_businessDate: key },
      create: { ...key, number: 1 },
      update: { number: { increment: 1 } },
    });
    const prefix = {
      NORMAL: service.prefix,
      PREFERENTIAL: service.preferentialPrefix,
      PRIORITY80: service.priority80Prefix,
    }[input.priority];
    const ticket = await db.ticket.create({
      data: {
        tenantId: scope.tenantId,
        unitId: scope.unitId,
        issuedServiceId: service.id,
        serviceId: service.id,
        businessDate: date,
        issuedAt: now,
        queuedAt: now,
        priority: input.priority,
        customerName:
          service.callMode === "NAME" && userId
            ? input.customerName
            : undefined,
        code: prefix + String(count.number).padStart(3, "0"),
        number: count.number,
        issueKey: input.requestId,
        publicToken: randomBytes(24).toString("base64url"),
      },
    });
    await event(db, scope, ticket, "ISSUED", {
      userId,
      toServiceId: service.id,
    });
    return {
      receipt: {
        ...ticketSummary(ticket),
        publicToken: ticket.publicToken,
        unitName: unit.name,
        timeZone: scope.timeZone,
        serviceName: service.name,
        peopleAhead: await position(db, scope, ticket, service),
      },
      change: { ticket, type: "ISSUED" },
    };
  });
}

async function counterSession(db: QueueDb, actor: Actor) {
  const session = await db.counterSession.findFirst({
    where: { unitId: actor.unitId, userId: actor.id, endedAt: null },
    include: { counter: true },
    orderBy: { startedAt: "desc" },
  });
  if (!session)
    throw new HttpError(409, "Selecione um guichê e inicie o turno.");
  return session;
}

export function callTicket(actor: Actor, code?: string): Promise<QueueChange> {
  return configureServices(actor, async (db) => {
    const session = await counterSession(db, actor);
    if (
      await db.ticket.count({
        where: {
          sessionId: session.id,
          unitId: actor.unitId,
          status: { in: [...activeStatuses] },
        },
      })
    ) {
      throw new HttpError(409, "Conclua a senha atual antes de chamar outra.");
    }
    const date = dateFor(actor);
    const services = await db.service.findMany({
      where: { unitId: actor.unitId, id: { in: session.serviceIds } },
    });
    const tickets = await db.ticket.findMany({
      where: {
        unitId: actor.unitId,
        serviceId: { in: services.map((service) => service.id) },
        businessDate: date,
        status: "WAITING",
        code,
        OR: [{ targetCounterId: null }, { targetCounterId: session.counterId }],
      },
    });
    const schedule = await db.queueSequence.findMany({
      where: {
        unitId: actor.unitId,
        businessDate: date,
        serviceId: { in: session.serviceIds },
      },
    });
    const candidates = services.flatMap((service) => {
      const available = tickets.filter(
        (ticket) => ticket.serviceId === service.id,
      );
      const selection = pickNextTicket(
        available,
        service,
        schedule.find((row) => row.serviceId === service.id)?.turn ?? 0,
      );
      return selection.ticket
        ? [{ service, ticket: selection.ticket, nextTurn: selection.nextTurn }]
        : [];
    });
    const selected = candidates.sort((a, b) =>
      compareQueueOrder(a.ticket, b.ticket),
    )[0];
    if (!selected)
      missing(
        code ? "Senha indisponível neste guichê." : "Nenhuma senha aguardando.",
      );
    const { service, ticket, nextTurn } = selected;
    if (!code) {
      const key = sequenceKey(actor, service.id, date);
      await db.queueSequence.upsert({
        where: { tenantId_unitId_serviceId_businessDate: key },
        create: { ...key, turn: nextTurn },
        update: { turn: nextTurn },
      });
    }
    const called = await db.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "CALLED",
        calledAt: new Date(),
        counterId: session.counterId,
        sessionId: session.id,
      },
    });
    const logged = await event(db, actor, called, "CALLED", {
      userId: actor.id,
      counterId: session.counterId,
      fromServiceId: service.id,
    });
    return {
      ticket: called,
      type: "CALLED",
      eventId: logged.id,
      eventTime: logged.at,
      counterName: session.counter.name,
      displayName: nameFor(service, called),
    };
  });
}

const transitions = {
  RECALL: { from: "CALLED", status: "CALLED", type: "RECALLED" },
  START: { from: "CALLED", status: "IN_SERVICE", type: "STARTED" },
  FINISH: { from: "IN_SERVICE", status: "FINISHED", type: "FINISHED" },
  NO_SHOW: { from: "CALLED", status: "NO_SHOW", type: "NO_SHOW" },
  CANCEL: { from: "WAITING", status: "CANCELED", type: "CANCELED" },
} as const;

export function updateTicket(
  actor: Actor,
  id: string,
  input: TicketAction,
): Promise<QueueChange> {
  return configureServices(actor, async (db) => {
    const session = await counterSession(db, actor);
    const ticket = await db.ticket.findFirst({
      where: {
        id,
        unitId: actor.unitId,
        ...(input.action === "CANCEL"
          ? {
              businessDate: dateFor(actor),
              serviceId: { in: session.serviceIds },
              OR: [
                { targetCounterId: null },
                { targetCounterId: session.counterId },
              ],
            }
          : { sessionId: session.id }),
      },
    });
    if (!ticket) missing("Senha indisponível neste guichê.");
    const context = {
      userId: actor.id,
      counterId: session.counterId,
      fromServiceId: ticket.serviceId,
    };
    if (input.action === "FORWARD") {
      if (ticket.status !== "IN_SERVICE")
        throw new HttpError(
          409,
          "Inicie o atendimento antes de encaminhar a senha.",
        );
      if (ticket.serviceId === input.serviceId)
        throw new HttpError(409, "Escolha outro serviço para encaminhar.");
      const service = await db.service.findFirst({
        where: { id: input.serviceId, unitId: actor.unitId, active: true },
      });
      if (!service) missing("Serviço de destino indisponível.");
      if (
        input.counterId &&
        !(await db.counter.findFirst({
          where: { id: input.counterId, unitId: actor.unitId, active: true },
        }))
      )
        missing("Guichê de destino indisponível.");
      const now = new Date();
      if (dateFor(actor, now) !== ticket.businessDate)
        throw new HttpError(
          409,
          "A senha é de uma data anterior. Finalize o atendimento atual.",
        );
      const data = { ...context, toServiceId: service.id };
      await db.ticket.update({ where: { id }, data: { status: "FORWARDED" } });
      await event(db, actor, ticket, "FORWARDED", data);
      const forwarded = await db.ticket.update({
        where: { id },
        data: {
          status: "WAITING",
          serviceId: service.id,
          targetCounterId: input.counterId ?? null,
          sessionId: null,
          counterId: null,
          calledAt: null,
          startedAt: null,
          queuedAt: now,
        },
      });
      await event(db, actor, forwarded, "QUEUED", data);
      return { ticket: forwarded, type: "FORWARDED" };
    }
    const transition = transitions[input.action];
    if (ticket.status !== transition.from)
      throw new HttpError(
        409,
        "A ação não está disponível para o estado desta senha.",
      );
    const now = new Date();
    const changed = await db.ticket.update({
      where: { id },
      data: {
        status: transition.status,
        startedAt: input.action === "START" ? now : undefined,
        finishedAt: ["NO_SHOW", "FINISH", "CANCEL"].includes(input.action)
          ? now
          : undefined,
      },
    });
    const logged = await event(db, actor, changed, transition.type, context);
    const service = await db.service.findUniqueOrThrow({
      where: { id: changed.serviceId },
    });
    return {
      ticket: changed,
      type: transition.type,
      eventId: logged.id,
      eventTime: logged.at,
      counterName: session.counter.name,
      displayName: nameFor(service, changed),
    };
  });
}

export async function queueStats(scope: QueueScope): Promise<QueueStat[]> {
  const db = tenantDb(scope.tenantId);
  const [services, stats] = await Promise.all([
    db.service.findMany({
      where: { unitId: scope.unitId },
      orderBy: [{ stageOrder: "asc" }, { name: "asc" }],
    }),
    db.ticket.groupBy({
      by: ["serviceId"],
      where: {
        unitId: scope.unitId,
        businessDate: dateFor(scope),
        status: "WAITING",
      },
      _min: { queuedAt: true },
      _count: { _all: true },
    }),
  ]);
  return services
    .filter(
      (service) =>
        service.active || stats.some((stat) => stat.serviceId === service.id),
    )
    .map((service) => {
      const stat = stats.find((item) => item.serviceId === service.id);
      return {
        serviceId: service.id,
        name: service.name,
        waiting: stat?._count._all ?? 0,
        oldest: stat?._min.queuedAt?.toISOString() ?? null,
      };
    });
}

export function expireQueue(scope: QueueScope, now: Date) {
  return tenantTransaction(scope.tenantId, async (db) => {
    await db.$queryRaw`SELECT id FROM "Unit" WHERE id = ${scope.unitId} AND "tenantId" = ${scope.tenantId} FOR UPDATE`;
    const expired = await db.ticket.findMany({
      where: {
        unitId: scope.unitId,
        businessDate: { lt: dateFor(scope, now) },
        status: "WAITING",
      },
    });
    if (!expired.length) return 0;
    await db.ticket.updateMany({
      where: { id: { in: expired.map((ticket) => ticket.id) } },
      data: { status: "CANCELED", finishedAt: now },
    });
    await db.ticketEvent.createMany({
      data: expired.map((ticket) => ({
        tenantId: scope.tenantId,
        unitId: scope.unitId,
        ticketId: ticket.id,
        type: "CANCELED",
        fromServiceId: ticket.serviceId,
        at: now,
      })),
    });
    return expired.length;
  });
}
