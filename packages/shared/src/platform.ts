import { z } from "zod";
import {
  emailSchema,
  nameSchema,
  passwordSchema,
  tenantInput,
} from "./admin.js";

const limit = z.number().int().min(0).max(10000).nullable();
const planName = z.string().trim().min(1).max(60).nullable();

export const tenantProvisionInput = tenantInput
  .extend({
    planName: planName.default("Essencial"),
    kioskLimit: limit.default(1),
    panelLimit: limit.default(1),
  })
  .strict();

export const tenantAccessInput = z.strictObject({
  name: nameSchema,
  planName,
  kioskLimit: limit,
  panelLimit: limit,
  active: z.boolean(),
});

export type TenantAccess = z.infer<typeof tenantAccessInput>;
export type DeviceAllowance = {
  KIOSK: { used: number; limit: number | null };
  PANEL: { used: number; limit: number | null };
};
export type PlatformCompany = TenantAccess & {
  id: string;
  slug: string;
  createdAt: string;
  deviceUsage: DeviceAllowance;
};

export const adminPasswordResetInput = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
});
