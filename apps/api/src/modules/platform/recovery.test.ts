import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { prisma, tenantDb } from "../../db.js";
import { createTenant } from "../admin/service.js";
import { authenticate } from "../auth/service.js";
import { recoverSuperadmin } from "./recovery.js";

const operatorSlug = `recovery-${randomUUID()}`;
const customerSlug = `recovery-client-${randomUUID()}`;
const forgotten = "a password nobody remembers";
const created: string[] = [];

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("superadmin recovery", () => {
  beforeAll(async () => {
    const operator = await createTenant(
      {
        slug: operatorSlug,
        name: "Operador",
        unitName: "Beend",
        adminName: "Equipe",
        email: "changed-later@beend.local",
        password: forgotten,
      },
      "SUPERADMIN",
    );
    const customer = await createTenant({
      slug: customerSlug,
      name: "Cliente",
      unitName: "Unidade",
      adminName: "Admin do cliente",
      email: "admin@cliente.local",
      password: forgotten,
    });
    created.push(operator.id, customer.id);
    await tenantDb(operator.id).user.updateMany({
      data: { active: false },
    });
  });
  afterAll(async () => {
    for (const id of created) await prisma.tenant.delete({ where: { id } });
    await prisma.$disconnect();
  });

  test("issues a temporary password that must be changed and revokes old sessions", async () => {
    const before = Date.now();
    const recovered = await recoverSuperadmin({ slug: operatorSlug });
    expect(recovered.email).toBe("changed-later@beend.local");
    expect(recovered.password.length).toBeGreaterThanOrEqual(20);

    await expect(
      authenticate(operatorSlug, recovered.email, forgotten, Date.now()),
    ).rejects.toThrow();
    const actor = await authenticate(
      operatorSlug,
      recovered.email,
      recovered.password,
      Date.now(),
    );
    expect(actor.role).toBe("SUPERADMIN");
    expect(actor.mustChangePassword).toBe(true);
    const user = await tenantDb(created[0]!).user.findFirstOrThrow({});
    expect(user.active).toBe(true);
    expect(user.credentialsChangedAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  test("can also restore a known e-mail address", async () => {
    const recovered = await recoverSuperadmin({
      slug: operatorSlug,
      email: "  SuperAdmin@Beend.local ",
    });
    expect(recovered.email).toBe("superadmin@beend.local");
    await expect(
      authenticate(
        operatorSlug,
        "superadmin@beend.local",
        recovered.password,
        Date.now(),
      ),
    ).resolves.toMatchObject({ role: "SUPERADMIN" });
  });

  test("never touches company administrators", async () => {
    await expect(recoverSuperadmin({ slug: customerSlug })).rejects.toThrow(
      "Nenhuma conta superadmin",
    );
    await expect(
      authenticate(customerSlug, "admin@cliente.local", forgotten, Date.now()),
    ).resolves.toMatchObject({ role: "ADMIN" });
    await expect(
      recoverSuperadmin({ slug: `missing-${randomUUID()}` }),
    ).rejects.toThrow("Empresa");
  });
});
