import { hash } from "bcryptjs";
import type { Actor, ServiceInput } from "@beend/shared";
import type { Prisma } from "@prisma/client";
import {
  prisma,
  tenantDb,
  tenantTransaction,
  type TenantTransaction,
} from "../../db.js";
import { HttpError } from "../../errors.js";

export const userFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
} as const;

export async function createTenant(
  input: {
    slug: string;
    name: string;
    unitName: string;
    adminName: string;
    email: string;
    password: string;
    timeZone?: string;
    resetTime?: string;
    retentionDays?: number;
  },
  role: "ADMIN" | "SUPERADMIN" = "ADMIN",
) {
  const { unitName, adminName, email, password, ...tenant } = input;
  const passwordHash = await hash(password, 12);
  return prisma.tenant.create({
    data: {
      ...tenant,
      units: { create: { name: unitName } },
      users: { create: { name: adminName, email, passwordHash, role } },
    },
  });
}

export async function validatePrefixes(
  db: TenantTransaction,
  unitId: string,
  values: ServiceInput,
  id?: string,
) {
  const prefixes = [
    values.prefix,
    values.preferentialPrefix,
    values.priority80Prefix,
  ];
  const duplicate = await db.service.findFirst({
    where: {
      unitId,
      id: id ? { not: id } : undefined,
      OR: [
        { prefix: { in: prefixes } },
        { preferentialPrefix: { in: prefixes } },
        { priority80Prefix: { in: prefixes } },
      ],
    },
    select: { id: true },
  });
  if (duplicate)
    throw new HttpError(409, "Um dos prefixos já pertence a outro serviço.");
}

export async function configureServices<T>(
  actor: Pick<Actor, "tenantId" | "unitId">,
  work: (db: TenantTransaction) => Promise<T>,
) {
  return tenantTransaction(actor.tenantId, async (db) => {
    await db.$queryRaw`SELECT id FROM "Unit" WHERE id = ${actor.unitId} AND "tenantId" = ${actor.tenantId} FOR UPDATE`;
    return work(db);
  });
}

export async function updateTenantSettings(
  actor: Actor,
  data: Prisma.TenantUpdateInput,
  unitName: string,
) {
  await tenantTransaction(actor.tenantId, async (db) => {
    await db.tenant.update({ where: { id: actor.tenantId }, data });
    await db.unit.update({
      where: { id: actor.unitId },
      data: { name: unitName },
    });
  });
}

export function manageUsers(actor: Actor) {
  return tenantDb(actor.tenantId).user;
}
