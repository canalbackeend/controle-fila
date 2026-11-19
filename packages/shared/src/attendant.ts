import { z } from "zod";
import { idSchema } from "./admin.js";
import type { QueueStat, TicketSummary } from "./queue.js";

export const shiftInput = z.object({
  counterId: idSchema,
  serviceIds: z
    .array(idSchema)
    .min(1)
    .max(100)
    .transform((ids) => [...new Set(ids)]),
});
export type ShiftInput = z.infer<typeof shiftInput>;
export type ServiceOption = {
  id: string;
  name: string;
  callMode: "TICKET" | "NAME";
  stageOrder: number;
};
export type CounterOption = { id: string; name: string; number: number };
export type AttendantState = {
  services: ServiceOption[];
  counters: CounterOption[];
  session: {
    id: string;
    counterId: string;
    counterName: string;
    serviceIds: string[];
  } | null;
  active: TicketSummary | null;
  waiting: TicketSummary[];
  stats: QueueStat[];
};
export const deviceTokenSchema = z
  .string()
  .regex(/^[a-f0-9-]{36}\.[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/);
export type PanelCall = {
  id: string;
  ticketId: string;
  code: string;
  displayName?: string;
  counter: string;
  serviceId: string;
  isRecall: boolean;
  at: string;
};
