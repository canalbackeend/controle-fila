import { z } from "zod";
import { idSchema } from "./admin.js";

export const prioritySchema = z.enum(["NORMAL", "PREFERENTIAL", "PRIORITY80"]);
export type Priority = z.infer<typeof prioritySchema>;
export type TicketStatus =
  | "WAITING"
  | "CALLED"
  | "IN_SERVICE"
  | "FINISHED"
  | "FORWARDED"
  | "NO_SHOW"
  | "CANCELED";

export const priorityLabels: Record<Priority, string> = {
  NORMAL: "Normal",
  PREFERENTIAL: "Preferencial",
  PRIORITY80: "Prioridade 80+",
};
export const ticketStatusLabels: Record<TicketStatus, string> = {
  WAITING: "Aguardando chamada",
  CALLED: "Chamado",
  IN_SERVICE: "Em atendimento",
  FINISHED: "Finalizado",
  FORWARDED: "Encaminhado",
  NO_SHOW: "Não compareceu",
  CANCELED: "Cancelado",
};

export const issueInput = z.object({
  serviceId: idSchema,
  requestId: idSchema.optional(),
  priority: prioritySchema,
  customerName: z.string().trim().min(1).max(100).optional(),
});
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,5}\d{3,10}$/);
export const callInput = z.object({ code: code.optional() });
export const ticketActionInput = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["RECALL", "START", "FINISH", "NO_SHOW", "CANCEL"]),
  }),
  z.object({
    action: z.literal("FORWARD"),
    serviceId: idSchema,
    counterId: idSchema.optional(),
  }),
]);
export type TicketAction = z.infer<typeof ticketActionInput>;
export type IssueInput = z.infer<typeof issueInput>;
export type TicketSummary = {
  id: string;
  code: string;
  priority: Priority;
  status: TicketStatus;
  serviceId: string;
  queuedAt: string;
  issuedAt: string;
  targetCounterId: string | null;
  displayName?: string;
};
export type IssuedTicket = TicketSummary & {
  publicToken: string;
  serviceName: string;
  unitName: string;
  peopleAhead: number;
  timeZone: string;
};
export type QueueStat = {
  serviceId: string;
  name: string;
  waiting: number;
  oldest: string | null;
};
export type QueueTicket = { id: string; priority: Priority; queuedAt: Date };
type Ratio = { ratioNormal: number; ratioPreferential: number };

export function compareQueueOrder(a: QueueTicket, b: QueueTicket) {
  return (
    a.queuedAt.getTime() - b.queuedAt.getTime() || a.id.localeCompare(b.id)
  );
}

export function pickNextTicket<T extends QueueTicket>(
  tickets: readonly T[],
  ratio: Ratio | "arrival",
  turn = 0,
) {
  const cycle =
    ratio === "arrival" ? 1 : ratio.ratioNormal + ratio.ratioPreferential;
  const normalized = turn % cycle;
  let oldest: T | undefined;
  let normal: T | undefined;
  let preferential: T | undefined;
  for (const ticket of tickets) {
    if (
      ratio === "arrival" &&
      (!oldest || compareQueueOrder(ticket, oldest) < 0)
    )
      oldest = ticket;
    if (ticket.priority === "NORMAL") {
      if (!normal || compareQueueOrder(ticket, normal) < 0) normal = ticket;
    } else if (
      !preferential ||
      (ticket.priority === "PRIORITY80" &&
        preferential.priority !== "PRIORITY80") ||
      (ticket.priority === preferential.priority &&
        compareQueueOrder(ticket, preferential) < 0)
    ) {
      preferential = ticket;
    }
  }
  // When merging service candidates, arrival determines which block is next.
  const wantsNormal =
    ratio === "arrival"
      ? oldest?.priority === "NORMAL"
      : normalized < ratio.ratioNormal;
  const preferred = wantsNormal ? normal : preferential;
  const fallback = wantsNormal ? preferential : normal;
  return {
    ticket: preferred ?? fallback,
    nextTurn: preferred ? (normalized + 1) % cycle : normalized,
  };
}

export function businessDate(now: Date, timeZone: string, resetTime: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  if (`${get("hour")}:${get("minute")}` >= resetTime) return date;
  const previous = new Date(`${date}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

export function shortCustomerName(name: string | null) {
  if (!name) return undefined;
  const [first, second] = name.trim().split(/\s+/);
  return second
    ? `${first} ${[...second][0]?.toLocaleUpperCase("pt-BR")}.`
    : first;
}
