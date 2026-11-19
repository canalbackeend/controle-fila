import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "vitest";
import { buildApp } from "../../app.js";
import { prisma, tenantDb } from "../../db.js";
import { createTenant } from "../admin/service.js";

const password = "integration-start-password";
const updatedPassword = "integration-renewed-password";
const operatorSlug = `operator-${randomUUID()}`;
const customerSlug = `customer-${randomUUID()}`;
const email = "member@test.local";
const created: string[] = [];
const app = buildApp(
  {},
  {
    secret: "fixed secret for platform tests",
    origin: "http://localhost:5180",
    secure: false,
  },
);

async function login(tenant: string, password: string) {
  return app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { tenant, email, password },
  });
}
function cookieOf(response: Awaited<ReturnType<typeof login>>) {
  return String(response.headers["set-cookie"]).split(";")[0]!;
}

beforeAll(async () => {
  if (process.env.RUN_DB_TESTS !== "1") return;
  const operator = await createTenant(
    {
      slug: operatorSlug,
      name: "Operador",
      unitName: "Beend",
      email,
      adminName: "Operador",
      password,
    },
    "SUPERADMIN",
  );
  created.push(operator.id);
});
afterAll(async () => {
  for (const id of created.reverse()) {
    const db = tenantDb(id);
    await db.ticketEvent.deleteMany({});
    await db.ticket.deleteMany({});
    await db.queueSequence.deleteMany({});
    await db.device.deleteMany({});
    await db.service.deleteMany({});
    await db.tenant.delete({ where: { id } });
  }
  await app.close();
  await prisma.$disconnect();
});

test.skipIf(process.env.RUN_DB_TESTS !== "1")(
  "provisions an isolated client, enforces device quotas concurrently and controls access",
  async () => {
    const operator = await login(operatorSlug, password);
    expect(operator.statusCode, operator.body).toBe(200);
    const admin = { cookie: cookieOf(operator) };
    const provision = await app.inject({
      method: "POST",
      url: "/admin/tenants",
      headers: admin,
      payload: {
        name: "Cliente",
        slug: customerSlug,
        unitName: "Recepção",
        adminName: "Cliente administrador",
        email,
        password,
        kioskLimit: 1,
        panelLimit: 0,
      },
    });
    expect(provision.statusCode, provision.body).toBe(201);
    const { id } = provision.json();
    created.push(id);
    expect(provision.json()).toMatchObject({
      active: true,
      planName: "Essencial",
      kioskLimit: 1,
      panelLimit: 0,
    });
    expect(provision.body).not.toContain(password);
    const first = await login(customerSlug, password);
    expect(first.json().mustChangePassword).toBe(true);
    const temporary = { cookie: cookieOf(first) };
    expect(
      (await app.inject({ url: "/admin", headers: temporary })).statusCode,
    ).toBe(403);
    const firstChange = await app.inject({
      method: "PUT",
      url: "/auth/profile",
      headers: temporary,
      payload: {
        name: "Cliente administrador",
        email,
        currentPassword: password,
        newPassword: updatedPassword,
      },
    });
    expect(firstChange.statusCode, firstChange.body).toBe(200);
    expect(firstChange.json().mustChangePassword).toBe(false);
    const client = { cookie: cookieOf(firstChange) };
    const administrators = (companyId: string, headers = admin) =>
      app.inject({
        url: `/admin/tenants/${companyId}/administrators`,
        headers,
      });
    const allowed = await administrators(id);
    expect(allowed.json()).toEqual([
      {
        name: "Cliente administrador",
        email,
        active: true,
        mustChangePassword: false,
      },
    ]);
    expect((await administrators(id, client)).statusCode).toBe(403);
    expect((await administrators(created[0]!)).statusCode).toBe(404);
    const devices = (headers = admin) =>
      app.inject({ url: "/admin/platform/devices", headers });
    expect((await devices(client)).statusCode).toBe(403);
    const operatorAccount = operator.json();
    const internalDevice = await tenantDb(
      operatorAccount.tenantId,
    ).device.create({
      data: {
        tenantId: operatorAccount.tenantId,
        unitId: operatorAccount.unitId,
        type: "PANEL",
        name: "TV interna da Beend",
      },
    });
    expect((await devices()).json()).not.toContainEqual(
      expect.objectContaining({ id: internalDevice.id }),
    );
    await tenantDb(operatorAccount.tenantId).device.delete({
      where: { id: internalDevice.id },
    });
    const update = (
      target: string,
      values: { active: boolean; kioskLimit: number; panelLimit: number },
      headers = admin,
    ) =>
      app.inject({
        method: "PUT",
        url: `/admin/tenants/${target}`,
        headers,
        payload: { name: "Cliente", planName: "Essencial", ...values },
      });
    const resetAccess = (target: string, headers = admin) =>
      app.inject({
        method: "POST",
        url: `/admin/tenants/${target}/admin-password`,
        headers,
        payload: { email, password },
      });
    expect(
      (await app.inject({ url: "/admin/tenants", headers: client })).statusCode,
    ).toBe(403);
    expect(
      (await update(id, { active: true, kioskLimit: 9, panelLimit: 9 }, client))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await update(created[0]!, {
          active: false,
          kioskLimit: 0,
          panelLimit: 0,
        })
      ).statusCode,
    ).toBe(404);
    expect((await resetAccess(created[0]!)).statusCode).toBe(404);
    expect((await resetAccess(id, client)).statusCode).toBe(403);

    const register = (type: "KIOSK" | "PANEL", name: string) =>
      app.inject({
        method: "POST",
        url: "/admin/devices",
        headers: client,
        payload: { type, name },
      });
    expect((await register("PANEL", "TV")).statusCode).toBe(409);
    const simultaneous = await Promise.all([
      register("KIOSK", "Recepção 1"),
      register("KIOSK", "Recepção 2"),
    ]);
    expect(simultaneous.map((response) => response.statusCode).sort()).toEqual([
      201, 409,
    ]);
    const inventory = await app.inject({
      url: "/admin/devices/allowance",
      headers: client,
    });
    expect(inventory.json()).toEqual({
      KIOSK: { used: 1, limit: 1 },
      PANEL: { used: 0, limit: 0 },
    });
    const operatorInventory = await app.inject({
      url: "/admin/devices/allowance",
      headers: admin,
    });
    expect(operatorInventory.json()).toEqual({
      KIOSK: { used: 0, limit: null },
      PANEL: { used: 0, limit: null },
    });

    const { device, code } = simultaneous
      .find((response) => response.statusCode === 201)!
      .json();
    const paired = await app.inject({
      method: "POST",
      url: `/devices/${device.id}/pair`,
      payload: { code },
    });
    expect(paired.statusCode).toBe(200);
    const deviceHeaders = { authorization: `Bearer ${paired.json().token}` };
    expect(
      (await update(id, { active: true, kioskLimit: 0, panelLimit: 0 }))
        .statusCode,
    ).toBe(409);
    expect(
      (await update(id, { active: true, kioskLimit: 1, panelLimit: 1 }))
        .statusCode,
    ).toBe(200);
    const pending = await register("PANEL", "TV liberada");
    expect(pending.statusCode).toBe(201);
    const registeredPanel = pending.json();
    const overview = await devices();
    expect(overview.statusCode).toBe(200);
    expect(
      overview
        .json()
        .filter((row: { company: { id: string } }) => row.company.id === id),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: device.id,
          company: expect.objectContaining({
            id,
            name: "Cliente",
            slug: customerSlug,
          }),
          type: "KIOSK",
          status: "ONLINE",
        }),
        expect.objectContaining({
          id: registeredPanel.device.id,
          type: "PANEL",
          status: "UNPAIRED",
        }),
      ]),
    );
    expect(overview.body).not.toContain(paired.json().token);
    expect(overview.body).not.toContain("tokenHash");
    const platform = await app.inject({
      url: "/admin/tenants",
      headers: admin,
    });
    expect(platform.json()).toContainEqual(
      expect.objectContaining({
        id,
        deviceUsage: {
          KIOSK: { used: 1, limit: 1 },
          PANEL: { used: 1, limit: 1 },
        },
      }),
    );

    const db = tenantDb(id);
    await db.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date(Date.now() - 100_000) },
    });
    expect((await devices()).json()).toContainEqual(
      expect.objectContaining({ id: device.id, status: "OFFLINE" }),
    );
    const account = firstChange.json();
    const date = new Intl.DateTimeFormat("sv-SE", {
      timeZone: account.timeZone,
      dateStyle: "short",
    }).format(new Date());
    const service = await db.service.create({
      data: {
        tenantId: id,
        unitId: account.unitId,
        name: "Recepção",
        prefix: "R",
        preferentialPrefix: "RP",
        priority80Prefix: "RS",
      },
    });
    const issued = await app.inject({
      method: "POST",
      url: "/queue/tickets",
      headers: client,
      payload: { serviceId: service.id, priority: "NORMAL" },
    });
    expect(issued.statusCode, issued.body).toBe(201);
    const track = `/track/${issued.json().publicToken}`;
    expect((await app.inject(track)).statusCode).toBe(200);
    expect(
      (
        await app.inject({
          url: `/reports?from=${date}&to=${date}`,
          headers: client,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await update(id, { active: false, kioskLimit: 1, panelLimit: 1 }))
        .statusCode,
    ).toBe(200);
    expect((await login(customerSlug, updatedPassword)).statusCode).toBe(403);
    expect((await devices()).json()).toContainEqual(
      expect.objectContaining({ id: device.id, status: "SUSPENDED" }),
    );
    expect(
      (await app.inject({ url: "/admin", headers: client })).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ url: `/kiosk/${device.id}`, headers: deviceHeaders }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/devices/${registeredPanel.device.id}/pair`,
          payload: { code: registeredPanel.code },
        })
      ).statusCode,
    ).toBe(403);
    expect((await app.inject(track)).statusCode).toBe(403);
    expect(
      (await update(id, { active: true, kioskLimit: 1, panelLimit: 1 }))
        .statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ url: `/kiosk/${device.id}`, headers: deviceHeaders }))
        .statusCode,
    ).toBe(200);
    expect((await app.inject(track)).statusCode).toBe(200);
    expect((await resetAccess(id)).statusCode).toBe(204);
    const pairedPanel = await app.inject({
      method: "POST",
      url: `/devices/${registeredPanel.device.id}/pair`,
      payload: { code: registeredPanel.code },
    });
    expect(pairedPanel.statusCode).toBe(200);
    expect((await devices()).json()).toContainEqual(
      expect.objectContaining({
        id: registeredPanel.device.id,
        type: "PANEL",
        status: "ONLINE",
      }),
    );
    expect(
      (await app.inject({ url: "/auth/session", headers: client })).statusCode,
    ).toBe(401);
    expect((await login(customerSlug, updatedPassword)).statusCode).toBe(401);
    const recovered = await login(customerSlug, password);
    expect(recovered.statusCode, recovered.body).toBe(200);
    expect(recovered.json().mustChangePassword).toBe(true);
  },
  20000,
);
