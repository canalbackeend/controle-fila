import { createHash } from "node:crypto";
import { deviceTokenSchema } from "@beend/shared";
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
