import { z } from "zod";
import { nameSchema, slugSchema } from "./admin.js";
import type { ServiceOption } from "./attendant.js";

export const deviceTypeSchema = z.enum(["PANEL", "KIOSK"]);
export const deviceInput = z.object({
  type: deviceTypeSchema,
  name: nameSchema,
});
export const pairInput = z.object({
  code: z
    .string()
    .trim()
    .max(80)
    .toLowerCase()
    .regex(/^[a-z0-9-]+\.[a-f0-9]{8}$/)
    .refine((value) => slugSchema.safeParse(value.split(".")[0]).success),
});
export type DeviceType = z.infer<typeof deviceTypeSchema>;
export type DeviceRecord = {
  id: string;
  name: string;
  type: DeviceType;
  paired: boolean;
  lastSeenAt: string | null;
};
export type DevicePairing = {
  device: DeviceRecord;
  code: string;
  expiresAt: string;
};
export type KioskData = { unitName: string; services: ServiceOption[] };
