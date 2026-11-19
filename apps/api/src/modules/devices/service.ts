import { randomBytes } from "node:crypto";
import type { Device } from "@prisma/client";
import type {
  Actor,
  DevicePairing,
  DeviceRecord,
  DeviceType,
} from "@beend/shared";
import { lockTenant, prisma, tenantTransaction } from "../../db.js";
import { HttpError, missing } from "../../errors.js";
import { canCreateDevice } from "./limits.js";
import { digest } from "./auth.js";

export function deviceRecord(device: Device): DeviceRecord {
  return {
    id: device.id,
    name: device.name,
    type: device.type,
    paired: Boolean(device.tokenHash),
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
  };
}

export async function newPairing(
  actor: Actor,
  input: { name: string; type: DeviceType } | { id: string },
): Promise<DevicePairing> {
  return tenantTransaction(actor.tenantId, async (db) => {
    await lockTenant(db, actor.tenantId);
    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: actor.tenantId },
      select: {
        slug: true,
        kioskLimit: true,
        panelLimit: true,
        suspendedAt: true,
      },
    });
    if (tenant.suspendedAt)
      throw new HttpError(403, "O acesso desta empresa está suspenso.");
    if ("type" in input) {
      const used = await db.device.count({ where: { type: input.type } });
      canCreateDevice(tenant, input.type, used);
    }
    const code = `${tenant.slug}.${randomBytes(4).toString("hex")}`;
    const expires = new Date(Date.now() + 15 * 60_000);
    const data = {
      pairingCodeHash: digest(code),
      pairingExpiresAt: expires,
      tokenHash: null,
      lastSeenAt: null,
    };
    const device =
      "id" in input
        ? await db.device.update({
            where: { id: input.id, unitId: actor.unitId },
            data,
          })
        : await db.device.create({
            data: {
              tenantId: actor.tenantId,
              unitId: actor.unitId,
              ...input,
              ...data,
            },
          });
    return {
      device: deviceRecord(device),
      code,
      expiresAt: expires.toISOString(),
    };
  });
}

export async function pairDevice(id: string, code: string) {
  const slug = code.split(".")[0]!;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) missing("Código de pareamento inválido ou expirado.");
  return tenantTransaction(tenant.id, async (db) => {
    await lockTenant(db, tenant.id);
    const current = await db.tenant.findUniqueOrThrow({
      where: { id: tenant.id },
      select: { suspendedAt: true },
    });
    if (current.suspendedAt)
      throw new HttpError(403, "O acesso desta empresa está suspenso.");
    const token = `${tenant.id}.${id}.${randomBytes(32).toString("base64url")}`;
    const { count } = await db.device.updateMany({
      where: {
        id,
        pairingCodeHash: digest(code),
        pairingExpiresAt: { gt: new Date() },
        tokenHash: null,
      },
      data: {
        pairingCodeHash: null,
        pairingExpiresAt: null,
        tokenHash: digest(token),
        lastSeenAt: new Date(),
      },
    });
    if (!count) missing("Código de pareamento inválido ou expirado.");
    return { token };
  });
}
