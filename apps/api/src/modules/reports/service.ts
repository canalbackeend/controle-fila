import type { TicketEvent } from "@prisma/client";
import {
  dayStartUtc,
  nextDay,
  type Actor,
  type Report,
  type ReportInput,
  type ReportMetrics,
  type ReportOptions,
} from "@beend/shared";
import { tenantDb } from "../../db.js";
import { missing } from "../../errors.js";

const terminal = ["FINISHED", "FORWARDED", "NO_SHOW"] as const;

export async function reportOptions(actor: Actor): Promise<ReportOptions> {
  const db = tenantDb(actor.tenantId);
  const names = { id: true, name: true } as const;
  const [services, attendants] = await Promise.all([
    db.service.findMany({
      where: { unitId: actor.unitId },
      select: names,
      orderBy: { name: "asc" },
    }),
    db.user.findMany({ select: names, orderBy: { name: "asc" } }),
  ]);
  return { services, attendants };
}

type Sample = {
  close: TicketEvent;
  wait?: number;
  duration?: number;
  hour: number;
};

function samples(
  events: TicketEvent[],
  endings: Set<string>,
  timeZone: string,
) {
  const hourFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  });
  const byTicket = Map.groupBy(events, (event) => event.ticketId);
  const results: Sample[] = [];
  for (const series of byTicket.values()) {
    let queued: Date | undefined;
    let called: Date | undefined;
    let started: Date | undefined;
    for (const event of series) {
      if (event.type === "ISSUED" || event.type === "QUEUED") {
        queued = event.at;
        called = undefined;
        started = undefined;
      } else if (event.type === "CALLED") called = event.at;
      else if (event.type === "STARTED") started = event.at;
      if (endings.has(event.id))
        results.push({
          close: event,
          wait:
            queued && called
              ? Math.max(0, called.getTime() - queued.getTime()) / 1000
              : undefined,
          duration:
            started && event.type !== "NO_SHOW"
              ? Math.max(0, event.at.getTime() - started.getTime()) / 1000
              : undefined,
          hour: Number(hourFormat.format(started ?? called ?? event.at)),
        });
    }
  }
  return results;
}

function summarize(items: Sample[]): ReportMetrics {
  const noShows = items.filter(({ close }) => close.type === "NO_SHOW").length;
  const average = (values: number[]) =>
    values.length
      ? Math.round(
          values.reduce((sum, value) => sum + value, 0) / values.length,
        )
      : 0;
  return {
    completed: items.length - noShows,
    noShows,
    waitSeconds: average(items.flatMap(({ wait }) => wait ?? [])),
    serviceSeconds: average(items.flatMap(({ duration }) => duration ?? [])),
    noShowRate: items.length
      ? Math.round((noShows * 1000) / items.length) / 10
      : 0,
  };
}

export async function report(
  actor: Actor,
  input: ReportInput,
): Promise<Report> {
  const db = tenantDb(actor.tenantId);
  const { services, attendants } = await reportOptions(actor);
  if (
    (input.serviceId && !services.some(({ id }) => id === input.serviceId)) ||
    (input.userId && !attendants.some(({ id }) => id === input.userId))
  ) {
    missing("Filtro indisponível para esta unidade.");
  }
  const from = dayStartUtc(input.from, actor.timeZone);
  const to = dayStartUtc(nextDay(input.to), actor.timeZone);
  const endings = await db.ticketEvent.findMany({
    where: {
      unitId: actor.unitId,
      at: { gte: from, lt: to },
      type: { in: [...terminal] },
      fromServiceId: input.serviceId,
      userId: input.userId,
    },
    select: { ticketId: true, id: true },
  });
  const ticketIds = [...new Set(endings.map(({ ticketId }) => ticketId))];
  const events: TicketEvent[] = [];
  for (let index = 0; index < ticketIds.length; index += 5000) {
    const part = await db.ticketEvent.findMany({
      where: {
        unitId: actor.unitId,
        ticketId: { in: ticketIds.slice(index, index + 5000) },
        at: { lt: to },
      },
      orderBy: [{ at: "asc" }, { type: "asc" }, { id: "asc" }],
    });
    events.push(...part);
  }
  const items = samples(
    events,
    new Set(endings.map(({ id }) => id)),
    actor.timeZone,
  );
  const hours = Array<number>(24).fill(0);
  for (const { hour } of items) hours[hour] = (hours[hour] ?? 0) + 1;
  const groups = Map.groupBy(
    items,
    ({ close }) => `${close.fromServiceId ?? ""}:${close.userId ?? ""}`,
  );
  const rows = [...groups.values()]
    .map((group) => ({
      ...summarize(group),
      service:
        services.find(({ id }) => id === group[0]?.close.fromServiceId)?.name ??
        "Serviço",
      attendant:
        attendants.find(({ id }) => id === group[0]?.close.userId)?.name ??
        "Atendente",
    }))
    .sort(
      (a, b) =>
        a.service.localeCompare(b.service, "pt-BR") ||
        a.attendant.localeCompare(b.attendant, "pt-BR"),
    );
  return { metrics: summarize(items), rows, hours };
}

export function reportCsv(result: Report) {
  const cell = (value: string | number) => {
    const text =
      typeof value === "string" && /^[\s]*[=+@\-\t\r\n]/.test(value)
        ? "'" + value
        : String(value);
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows = [
    [
      "Serviço",
      "Atendente",
      "Atendimentos",
      "Não comparecimentos",
      "Espera média (segundos)",
      "Atendimento médio (segundos)",
      "Não comparecimento (%)",
    ],
    ...result.rows.map((row) => [
      row.service,
      row.attendant,
      row.completed,
      row.noShows,
      row.waitSeconds,
      row.serviceSeconds,
      row.noShowRate,
    ]),
    [],
    ["Hora", "Registros"],
    ...result.hours.map((total, hour) => [
      `${String(hour).padStart(2, "0")}:00`,
      total,
    ]),
  ];
  return (
    "\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n") + "\r\n"
  );
}
