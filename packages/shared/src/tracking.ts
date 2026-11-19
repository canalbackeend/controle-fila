import type { TenantTheme } from "./theme.js";
import { z } from "zod";
import type { TicketStatus } from "./queue.js";

export const publicTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/);
export const trackingParams = z.object({ token: publicTokenSchema });
export type TrackingData = {
  theme: TenantTheme;
  code: string;
  unitName: string;
  service: { id: string; name: string };
  status: TicketStatus;
  peopleAhead: number;
  counterNumber?: number;
};
