import { z } from "zod";
import { idSchema } from "./admin.js";
import type { QueueStat, TicketSummary } from "./queue.js";

const shiftServices = z.object({
  serviceIds: z
    .array(idSchema)
    .min(1)
    .max(100)
    .transform((ids) => [...new Set(ids)]),
});
export const shiftInput = shiftServices.extend({ counterId: idSchema });
export const shiftServicesInput = shiftServices
  .extend({ shiftId: idSchema })
  .strict();
export type ShiftInput = z.infer<typeof shiftInput>;
export type ShiftServicesInput = z.infer<typeof shiftServicesInput>;
const activeTicketStatus = z.enum(["CALLED", "IN_SERVICE"]);
export const recoverShiftInput = z.strictObject({
  ticket: z
    .strictObject({
      id: idSchema,
      status: activeTicketStatus,
      action: z.enum(["REQUEUE", "CANCEL"]),
    })
    .optional(),
});
export type RecoverShiftInput = z.infer<typeof recoverShiftInput>;
export type OpenShift = {
  id: string;
  counterId: string;
  attendant: string;
  ticket: {
    id: string;
    code: string;
    status: z.infer<typeof activeTicketStatus>;
    canRequeue: boolean;
  } | null;
};
export type ServiceOption = {
  id: string;
  name: string;
  callMode: "TICKET" | "NAME";
  stageOrder: number;
};
export type CounterOption = {
  id: string;
  name: string;
  number: number;
  occupied: boolean;
};
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
