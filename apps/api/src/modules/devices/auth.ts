import { HttpError } from "../../errors.js";
import { createHash } from "node:crypto";
import { deviceTokenSchema, type DeviceType } from "@beend/shared";
import { tenantDb } from "../../db.js";

export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function deviceIdentity(token: unknown) {
  const parsed = deviceTokenSchema.safeParse(token);
  if (!parsed.success) return null;
  const [tenantId, id] = parsed.data.split(".") as [string, string];
  return tenantDb(tenantId).device.findFirst({
    where: { id, tokenHash: digest(parsed.data) },
  });
}

export async function requireDevice(
  authorization: string | undefined,
  id: string,
  type: DeviceType,
) {
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : undefined;
  const device = await deviceIdentity(token);
  if (!device || device.id !== id || device.type !== type)
    throw new HttpError(401, "Dispositivo precisa ser pareado.");
  const db = tenantDb(device.tenantId);
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: device.tenantId },
  });
  if (!device.lastSeenAt || Date.now() - device.lastSeenAt.getTime() > 30_000) {
    await db.device.updateMany({
      where: { id, tokenHash: device.tokenHash },
      data: { lastSeenAt: new Date() },
    });
  }
  return {
    device,
    db,
    tenant,
    scope: {
      tenantId: tenant.id,
      unitId: device.unitId,
      timeZone: tenant.timeZone,
      resetTime: tenant.resetTime,
    },
  };
}
