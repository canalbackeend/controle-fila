import { z } from "zod";

export const idSchema = z.uuid();
export const idParams = z.object({ id: idSchema });
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(60);
export const nameSchema = z.string().trim().min(1).max(100);
export const passwordSchema = z
  .string()
  .min(12)
  .refine((value) => new TextEncoder().encode(value).length <= 72);
const email = z.email().trim().toLowerCase().max(160);
const prefix = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,5}$/);
const timeZone = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  });
export const tenantInput = z.object({
  name: nameSchema,
  slug: slugSchema,
  timeZone: timeZone.default("America/Sao_Paulo"),
  resetTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .default("00:00"),
  retentionDays: z.coerce.number().int().min(1).max(365).default(30),
  unitName: nameSchema,
  adminName: nameSchema,
  email,
  password: passwordSchema,
});
export const tenantSettings = tenantInput.pick({
  name: true,
  timeZone: true,
  resetTime: true,
  retentionDays: true,
  unitName: true,
});
export const loginInput = z.object({
  tenant: slugSchema,
  email,
  password: z.string().min(1).max(72),
});
export const serviceInput = z.object({
  name: nameSchema,
  prefix,
  preferentialPrefix: prefix,
  priority80Prefix: prefix,
  callMode: z.enum(["TICKET", "NAME"]).default("TICKET"),
  ratioNormal: z.coerce.number().int().min(1).max(20).default(2),
  ratioPreferential: z.coerce.number().int().min(1).max(20).default(1),
  stageOrder: z.coerce.number().int().min(1).max(99).default(1),
  active: z.boolean().default(true),
});
export const counterInput = z.object({
  name: nameSchema,
  number: z.coerce.number().int().min(1).max(999),
  active: z.boolean().default(true),
});
export const userInput = z.object({
  name: nameSchema,
  email,
  role: z.enum(["ADMIN", "ATTENDANT"]),
  password: passwordSchema,
  active: z.boolean().default(true),
});
export const userUpdate = userInput.extend({
  password: passwordSchema.optional(),
});
export const templateInput = z.object({
  templateId: z.enum(["clinic", "registry", "retail"]),
});
export const templateConfig = z.object({
  services: z.array(serviceInput),
  counters: z.array(counterInput),
});
export type ServiceInput = z.infer<typeof serviceInput>;
export type CounterInput = z.infer<typeof counterInput>;
export type Role = "SUPERADMIN" | "ADMIN" | "ATTENDANT";
export type Actor = {
  id: string;
  tenantId: string;
  unitId: string;
  name: string;
  role: Role;
  tenantName: string;
  timeZone: string;
  resetTime: string;
};
