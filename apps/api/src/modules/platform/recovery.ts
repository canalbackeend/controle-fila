import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { emailSchema } from "@beend/shared";
import { lockTenant, prisma, tenantTransaction } from "../../db.js";

/**
 * Recovers the Beend operator account from the server shell. It issues a
 * random temporary password, reactivates the account, forces a password change
 * and invalidates previous sessions. Company administrators are never touched.
 */
export async function recoverSuperadmin({
  slug = "beend",
  email,
}: { slug?: string; email?: string } = {}) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) throw new Error(`Empresa "${slug}" não encontrada.`);
  const newEmail =
    email === undefined ? undefined : emailSchema.parse(email.trim());
  const password = randomBytes(18).toString("base64url");
  const passwordHash = await hash(password, 12);
  return tenantTransaction(tenant.id, async (db) => {
    await lockTenant(db, tenant.id);
    const user = await db.user.findFirst({
      where: { role: "SUPERADMIN" },
      orderBy: [{ active: "desc" }, { id: "asc" }],
      select: { id: true, email: true },
    });
    if (!user)
      throw new Error(`Nenhuma conta superadmin na empresa "${slug}".`);
    const updated = await db.user.update({
      where: { id: user.id, role: "SUPERADMIN" },
      data: {
        email: newEmail,
        passwordHash,
        active: true,
        mustChangePassword: true,
        credentialsChangedAt: new Date(),
      },
      select: { email: true },
    });
    return { slug, email: updated.email, password };
  });
}
