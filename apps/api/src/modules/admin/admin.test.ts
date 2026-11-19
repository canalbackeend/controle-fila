import { randomUUID } from "node:crypto";
import type { Actor, OpenShift } from "@beend/shared";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildApp } from "../../app.js";
import { prisma, tenantDb } from "../../db.js";
import { createTenant } from "./service.js";

const databaseTests = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!databaseTests)(
  "tenant administration and authentication",
  () => {
    const app = buildApp(
      {},
      {
        secret: "fixed secret for tests; never used in production",
        origin: "http://localhost:5180",
        secure: false,
      },
    );
    const input = {
      name: "Teste",
      unitName: "Unidade de teste",
      adminName: "Administrador",
      email: "admin@test.local",
      password: "integration-test-strong-password",
    };
    const actors: { id: string; cookie: string }[] = [];

    beforeAll(async () => {
      for (const name of ["Alfa", "Beta", "Beend Teste"]) {
        const slug = `test-${randomUUID()}`;
        const tenant = await createTenant(
          { ...input, slug, name },
          name === "Beend Teste" ? "SUPERADMIN" : "ADMIN",
        );
        const identity = { id: tenant.id, cookie: "" };
        actors.push(identity);
        const result = await app.inject({
          method: "POST",
          url: "/auth/login",
          payload: {
            tenant: slug,
            email: input.email,
            password: input.password,
          },
        });
        expect(result.statusCode).toBe(200);
        expect(result.headers["set-cookie"]).toContain("HttpOnly");
        identity.cookie = String(result.headers["set-cookie"]).split(";")[0]!;
      }
    });

    afterAll(async () => {
      for (const { id } of actors) {
        const db = tenantDb(id);
        await db.ticketEvent.deleteMany({});
        await db.ticket.deleteMany({});
        await db.queueSequence.deleteMany({});
        await db.card.deleteMany({});
        await db.device.deleteMany({});
        await db.counterSession.deleteMany({});
        await db.counter.deleteMany({});
        await db.service.deleteMany({});
        await db.tenant.delete({ where: { id } });
      }
      await app.close();
      await prisma.$disconnect();
    });

    test("rejects anonymous access, tampered cookies and invalid origins", async () => {
      const { cookie } = actors[0]!;
      expect((await app.inject("/admin")).statusCode).toBe(401);
      expect(
        (
          await app.inject({
            url: "/auth/session",
            headers: { cookie: cookie + "x" },
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: "PUT",
            url: "/admin/settings",
            headers: { cookie, origin: "https://foreign.invalid" },
            payload: {},
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (await app.inject({ url: "/admin/tenants", headers: { cookie } }))
          .statusCode,
      ).toBe(403);
    });

    test("lists and mutates only the authenticated tenant's services, counters, and users", async () => {
      const owner = actors[0]!;
      const outsider = actors[1]!;
      const headers = { cookie: owner.cookie };
      const service = {
        name: "Recepção",
        prefix: "R",
        preferentialPrefix: "RP",
        priority80Prefix: "RI",
      };
      const counter = { name: "Sala 1", number: 1 };
      const user = {
        name: "Atendimento",
        email: "staff@test.local",
        role: "ATTENDANT",
        password: input.password,
      };
      for (const [collection, payload] of Object.entries({
        services: service,
        counters: counter,
        users: user,
      })) {
        const created = await app.inject({
          method: "POST",
          url: `/admin/${collection}`,
          headers,
          payload,
        });
        expect(created.statusCode, created.body).toBe(201);
        const { id, passwordHash } = created.json();
        expect(passwordHash).toBeUndefined();
        const foreign = { cookie: outsider.cookie };
        const list = await app.inject({ url: "/admin", headers: foreign });
        expect(list.statusCode, list.body).toBe(200);
        expect(
          list
            .json()
            [collection].some((record: { id: string }) => record.id === id),
        ).toBe(false);
        expect(
          (
            await app.inject({
              method: "PUT",
              url: `/admin/${collection}/${id}`,
              headers: foreign,
              payload,
            })
          ).statusCode,
        ).toBe(404);
        expect(
          (
            await app.inject({
              method: "DELETE",
              url: `/admin/${collection}/${id}`,
              headers: foreign,
            })
          ).statusCode,
        ).toBe(404);
      }
      const configured = await app.inject({
        method: "POST",
        url: "/admin/template",
        headers: { cookie: outsider.cookie },
        payload: { templateId: "clinic" },
      });
      expect(configured.statusCode, configured.body).toBe(204);
      const saved = await app.inject({ url: "/admin", headers });
      expect(
        saved.json().services.map((item: { name: string }) => item.name),
      ).toEqual(["Recepção"]);
      expect(saved.json().counters).toHaveLength(1);
      expect(saved.json().users).toHaveLength(2);
    });

    test("lets only the superadmin publish reusable templates", async () => {
      const cookie = actors[2]!.cookie;
      const outsider = actors[0]!.cookie;
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/admin/templates",
            headers: { cookie: outsider },
            payload: { name: "Modelo" },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/admin/template",
            headers: { cookie },
            payload: { templateId: "registry" },
          })
        ).statusCode,
      ).toBe(204);
      const created = await app.inject({
        method: "POST",
        url: "/admin/templates",
        headers: { cookie },
        payload: { name: "Modelo de teste" },
      });
      expect(created.statusCode, created.body).toBe(201);
      const { id } = created.json();
      try {
        const catalog = await app.inject({
          url: "/admin",
          headers: { cookie: outsider },
        });
        expect(catalog.json().templates).toContainEqual({
          id,
          name: "Modelo de teste",
        });
      } finally {
        await prisma.template.delete({ where: { id } });
      }
    });

    test("keeps uploaded cards and panel configuration tenant-scoped", async () => {
      const cookie = actors[0]!.cookie;
      const outsider = actors[1]!.cookie;
      const card = {
        type: "NOTICE",
        title: "Aviso exclusivo",
        text: "Texto da unidade",
      };
      const created = await app.inject({
        method: "POST",
        url: "/admin/cards",
        headers: { cookie },
        payload: card,
      });
      expect(created.statusCode, created.body).toBe(201);
      const out = await app.inject({
        url: "/admin/content",
        headers: { cookie: outsider },
      });
      expect(out.json().cards).toEqual([]);
      const id = created.json().id;
      expect(
        (
          await app.inject({
            method: "PUT",
            url: `/admin/cards/${id}`,
            headers: { cookie: outsider },
            payload: card,
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: `/admin/cards/${id}`,
            headers: { cookie: outsider },
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/admin/cards",
            headers: { cookie },
            payload: { ...card, type: "TIP", global: true },
          })
        ).statusCode,
      ).toBe(403);
      const panel = await app.inject({
        method: "POST",
        url: "/admin/devices",
        headers: { cookie },
        payload: { name: "TV A", type: "PANEL" },
      });
      expect(panel.statusCode, panel.body).toBe(201);
      expect(
        (
          await app.inject({
            url: `/admin/panels/${panel.json().device.id}`,
            headers: { cookie: outsider },
          })
        ).statusCode,
      ).toBe(404);
    });

    test("pairs a kiosk once, confines its token to the device and tenant, and reuses a retried ticket", async () => {
      const cookie = actors[0]!.cookie;
      const outsider = actors[1]!.cookie;
      const createdService = await app.inject({
        method: "POST",
        url: "/admin/services",
        headers: { cookie },
        payload: {
          name: "Totem",
          prefix: "K",
          preferentialPrefix: "KP",
          priority80Prefix: "KI",
        },
      });
      expect(createdService.statusCode, createdService.body).toBe(201);
      const created = await app.inject({
        method: "POST",
        url: "/admin/devices",
        headers: { cookie },
        payload: { name: "Totem A", type: "KIOSK" },
      });
      expect(created.statusCode, created.body).toBe(201);
      const { code, device } = created.json();
      const links = (cookie?: string) =>
        app.inject({
          url: "/devices/links",
          headers: cookie ? { cookie } : {},
        });
      expect((await links()).statusCode).toBe(401);
      expect((await links(outsider)).json()).toEqual([]);
      expect((await links(cookie)).json()).toContainEqual({
        id: device.id,
        type: "KIOSK",
        name: device.name,
      });
      const pair = () =>
        app.inject({
          method: "POST",
          url: `/devices/${device.id}/pair`,
          payload: { code },
        });
      const paired = await pair();
      expect(paired.statusCode, paired.body).toBe(200);
      expect((await pair()).statusCode).toBe(404);
      const foreign = await app.inject({
        method: "POST",
        url: `/admin/devices/${device.id}/pairing`,
        headers: { cookie: outsider },
      });
      expect(foreign.statusCode).toBe(404);
      expect(
        (
          await app.inject({
            method: "PATCH",
            url: `/admin/devices/${device.id}`,
            headers: { cookie: outsider },
            payload: { name: "Outro nome" },
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await app.inject({
            method: "PATCH",
            url: `/admin/devices/${device.id}`,
            headers: { cookie },
            payload: { name: "Entrada" },
          })
        ).statusCode,
      ).toBe(204);
      const list = await app.inject({
        url: "/admin/devices",
        headers: { cookie: outsider },
      });
      expect(list.json()).toEqual([]);
      const headers = { authorization: `Bearer ${paired.json().token}` };
      expect(
        (await app.inject({ url: `/kiosk/${randomUUID()}`, headers }))
          .statusCode,
      ).toBe(401);
      const snapshot = await app.inject({
        url: `/kiosk/${device.id}`,
        headers,
      });
      expect(snapshot.statusCode, snapshot.body).toBe(200);
      const serviceId = createdService.json().id;
      expect(
        snapshot.json().services.map((service: { id: string }) => service.id),
      ).toContain(serviceId);
      const payload = {
        serviceId,
        priority: "NORMAL",
        requestId: randomUUID(),
        customerName: "Nome privado",
      };
      const issue = () =>
        app.inject({
          method: "POST",
          url: `/kiosk/${device.id}/tickets`,
          headers,
          payload,
        });
      const [first, retry] = await Promise.all([issue(), issue()]);
      expect(first.statusCode, first.body).toBe(201);
      expect(retry.statusCode, retry.body).toBe(201);
      expect(first.json().publicToken).toBe(retry.json().publicToken);
      expect(
        await tenantDb(actors[0]!.id).ticket.findFirst({
          where: { id: first.json().id },
        }),
      ).toMatchObject({ customerName: null });
      const rotated = await app.inject({
        method: "POST",
        url: `/admin/devices/${device.id}/pairing`,
        headers: { cookie },
      });
      expect(rotated.statusCode).toBe(200);
      expect(
        (await app.inject({ url: `/kiosk/${device.id}`, headers })).statusCode,
      ).toBe(401);
    });

    test("changes the company theme only for its own tenant and administrators", async () => {
      const first = actors[0]!;
      const second = actors[1]!;
      const db = tenantDb(first.id);
      const { slug } = await db.tenant.findUniqueOrThrow({
        where: { id: first.id },
      });
      const admin = { cookie: first.cookie };
      const set = (payload: object, headers = admin) =>
        app.inject({ method: "PUT", url: "/admin/theme", headers, payload });
      expect((await set({ preset: "custom", color: "red" })).statusCode).toBe(
        400,
      );
      expect(
        (await set({ preset: "red", tenantId: second.id })).statusCode,
      ).toBe(400);
      expect((await set({ preset: "red" }, { cookie: "" })).statusCode).toBe(
        401,
      );
      const staffLogin = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          tenant: slug,
          email: "staff@test.local",
          password: input.password,
        },
      });
      expect(staffLogin.statusCode).toBe(200);
      expect(
        (
          await set(
            { preset: "red" },
            { cookie: String(staffLogin.headers["set-cookie"]).split(";")[0]! },
          )
        ).statusCode,
      ).toBe(403);
      const response = await set({ preset: "custom", color: "#aa2639" });
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toEqual({ preset: "custom", color: "#AA2639" });
      const branding = await app.inject(`/auth/branding/${slug}`);
      expect(branding.json()).toEqual(response.json());
      expect(
        (await app.inject("/auth/branding/empresa-inexistente")).json(),
      ).toEqual({ preset: "blue" });
      const outside = await app.inject({
        url: "/auth/session",
        headers: { cookie: second.cookie },
      });
      expect(outside.json().theme).toEqual({ preset: "blue" });
    });

    test("allows personal themes for attendants without modifying the tenant or another account", async () => {
      const owner = actors[0]!;
      const outsider = actors[1]!;
      const { slug } = await tenantDb(owner.id).tenant.findUniqueOrThrow({
        where: { id: owner.id },
      });
      const staff = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          tenant: slug,
          email: "staff@test.local",
          password: input.password,
        },
      });
      expect(staff.statusCode).toBe(200);
      const cookie = String(staff.headers["set-cookie"]).split(";")[0]!;
      const put = (payload: object, headers = { cookie }) =>
        app.inject({
          method: "PUT",
          url: "/auth/profile/theme",
          payload,
          headers,
        });
      expect(
        (await put({ theme: { preset: "green" } }, { cookie: "" })).statusCode,
      ).toBe(401);
      expect(
        (await put({ theme: { preset: "green" }, tenantId: outsider.id }))
          .statusCode,
      ).toBe(400);
      expect(
        (await put({ theme: { preset: "custom", color: "invalid" } }))
          .statusCode,
      ).toBe(400);
      const response = await put({ theme: { preset: "green" } });
      expect(response.statusCode, response.body).toBe(200);
      const session = (cookie: string) =>
        app
          .inject({ url: "/auth/session", headers: { cookie } })
          .then((r) => r.json());
      expect(await session(cookie)).toMatchObject({
        theme: { preset: "custom", color: "#AA2639" },
        personalTheme: { preset: "green" },
      });
      expect(await session(owner.cookie)).toMatchObject({
        theme: { preset: "custom", color: "#AA2639" },
        personalTheme: null,
      });
      expect(await session(outsider.cookie)).toMatchObject({
        theme: { preset: "blue" },
        personalTheme: null,
      });
      expect((await put({ theme: null })).statusCode).toBe(200);
      expect(await session(cookie)).toMatchObject({ personalTheme: null });
    });

    test("recovers only local shifts and records the explicit resolution of the ticket", async () => {
      const owner = actors[0]!;
      const outsider = actors[1]!;
      const db = tenantDb(owner.id);
      const { slug } = await db.tenant.findUniqueOrThrow({
        where: { id: owner.id },
      });
      const headers = { cookie: owner.cookie };
      const admin = (
        await app.inject({ url: "/auth/session", headers })
      ).json<Actor>();
      const scope = { tenantId: owner.id, unitId: admin.unitId };
      const staff = {
        name: "Atendente de recuperação",
        email: "recovery@test.local",
        role: "ATTENDANT",
      };
      const created = await app.inject({
        method: "POST",
        url: "/admin/users",
        headers,
        payload: { ...staff, password: input.password },
      });
      expect(created.statusCode, created.body).toBe(201);
      const staffId = created.json().id;
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { tenant: slug, email: staff.email, password: input.password },
      });
      expect(login.statusCode, login.body).toBe(200);
      const staffCookie = String(login.headers["set-cookie"]).split(";")[0]!;
      const counter = await db.counter.create({
        data: { ...scope, name: "Guichê da recuperação", number: 89 },
      });
      const service = await db.service.create({
        data: {
          ...scope,
          name: "Recuperação",
          prefix: "GX",
          preferentialPrefix: "GXP",
          priority80Prefix: "GXI",
        },
      });
      const start = (cookie: string) =>
        app.inject({
          method: "POST",
          url: "/attendant/shift",
          headers: { cookie },
          payload: { counterId: counter.id, serviceIds: [service.id] },
        });
      expect((await start(staffCookie)).statusCode).toBe(204);
      const issued = await app.inject({
        method: "POST",
        url: "/queue/tickets",
        headers,
        payload: { serviceId: service.id, priority: "PRIORITY80" },
      });
      expect(issued.statusCode, issued.body).toBe(201);
      const ticketId = issued.json().id;
      const call = (cookie: string) =>
        app.inject({
          method: "POST",
          url: "/queue/call",
          headers: { cookie },
          payload: {},
        });
      expect((await call(staffCookie)).json()).toMatchObject({
        id: ticketId,
        status: "CALLED",
      });
      const shifts = async (cookie: string) =>
        (await app.inject({ url: "/admin/shifts", headers: { cookie } })).json<
          OpenShift[]
        >();
      const [shift] = await shifts(owner.cookie);
      expect(shift).toMatchObject({
        counterId: counter.id,
        ticket: { id: ticketId, status: "CALLED", canRequeue: true },
      });
      const recover = (cookie: string, payload: object, id = shift!.id) =>
        app.inject({
          method: "POST",
          url: `/admin/shifts/${id}/recover`,
          headers: { cookie },
          payload,
        });
      const resolution = {
        ticket: { id: ticketId, status: "CALLED", action: "REQUEUE" },
      };
      expect(await shifts(outsider.cookie)).toEqual([]);
      expect((await recover(outsider.cookie, resolution)).statusCode).toBe(404);
      expect((await recover(staffCookie, resolution)).statusCode).toBe(403);
      expect((await recover(owner.cookie, {})).statusCode).toBe(409);
      expect(
        (
          await recover(owner.cookie, {
            ticket: { ...resolution.ticket, status: "IN_SERVICE" },
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: `/admin/users/${staffId}`,
            headers,
          })
        ).statusCode,
      ).toBe(204);
      expect((await start(owner.cookie)).statusCode).toBe(409);
      expect((await recover(owner.cookie, resolution)).statusCode).toBe(204);
      expect((await recover(owner.cookie, resolution)).statusCode).toBe(409);
      expect(
        await db.ticket.findUnique({ where: { id: ticketId } }),
      ).toMatchObject({
        status: "WAITING",
        priority: "PRIORITY80",
        sessionId: null,
        counterId: null,
        startedAt: null,
      });
      expect((await start(owner.cookie)).statusCode).toBe(204);
      expect((await call(owner.cookie)).json()).toMatchObject({
        id: ticketId,
        status: "CALLED",
      });
      const [next] = await shifts(owner.cookie);
      await db.ticket.update({
        where: { id: ticketId },
        data: { businessDate: "2000-01-01" },
      });
      expect(
        (await recover(owner.cookie, resolution, next!.id)).statusCode,
      ).toBe(409);
      expect(
        (
          await recover(
            owner.cookie,
            { ticket: { ...resolution.ticket, action: "CANCEL" } },
            next!.id,
          )
        ).statusCode,
      ).toBe(204);
      expect(await shifts(owner.cookie)).toEqual([]);
      expect(
        await db.ticket.findUnique({ where: { id: ticketId } }),
      ).toMatchObject({ status: "CANCELED" });
      const events = await db.ticketEvent.findMany({
        where: { ticketId, type: { in: ["QUEUED", "CANCELED"] } },
      });
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "QUEUED",
            userId: admin.id,
            counterId: counter.id,
          }),
          expect.objectContaining({
            type: "CANCELED",
            userId: admin.id,
            counterId: counter.id,
          }),
        ]),
      );
      expect((await start(owner.cookie)).statusCode).toBe(204);
      const [idle] = await shifts(owner.cookie);
      expect(idle?.ticket).toBeNull();
      expect((await recover(owner.cookie, {}, idle!.id)).statusCode).toBe(204);
    });

    test("revokes old team cookies after a password reset and deactivation", async () => {
      const owner = actors[0]!;
      const { slug } = await tenantDb(owner.id).tenant.findUniqueOrThrow({
        where: { id: owner.id },
      });
      const headers = { cookie: owner.cookie };
      const user = {
        name: "Usuário de teste",
        email: "reset@test.local",
        role: "ATTENDANT",
      };
      const created = await app.inject({
        method: "POST",
        url: "/admin/users",
        headers,
        payload: { ...user, password: input.password },
      });
      expect(created.statusCode, created.body).toBe(201);
      const url = `/admin/users/${created.json().id}`;
      const login = (password: string) =>
        app.inject({
          method: "POST",
          url: "/auth/login",
          payload: { tenant: slug, email: user.email, password },
        });
      const old = await login(input.password);
      expect(old.statusCode, old.body).toBe(200);
      const session = (response: typeof old) =>
        app.inject({
          url: "/auth/session",
          headers: {
            cookie: String(response.headers["set-cookie"]).split(";")[0]!,
          },
        });
      const edit = (payload: object) =>
        app.inject({ method: "PUT", url, headers, payload });
      expect((await edit({ ...user, name: "Novo nome" })).statusCode).toBe(200);
      expect((await session(old)).statusCode).toBe(200);
      const password = "updated-integration-test-password";
      expect((await edit({ ...user, password })).statusCode).toBe(200);
      expect((await session(old)).statusCode).toBe(401);
      expect((await login(input.password)).statusCode).toBe(401);
      const fresh = await login(password);
      expect(fresh.statusCode, fresh.body).toBe(200);
      expect(
        (await app.inject({ method: "DELETE", url, headers })).statusCode,
      ).toBe(204);
      expect((await edit({ ...user, active: true })).statusCode).toBe(200);
      expect((await session(fresh)).statusCode).toBe(401);
      expect(
        (await app.inject({ url: "/auth/session", headers })).statusCode,
      ).toBe(200);
    });

    test("lets administrators edit their own profile and renews the session after changing credentials", async () => {
      const first = actors[0]!;
      const second = actors[1]!;
      const { slug } = await tenantDb(first.id).tenant.findUniqueOrThrow({
        where: { id: first.id },
      });
      const headers = { cookie: first.cookie };
      const put = (payload: object, cookie = first.cookie) =>
        app.inject({
          method: "PUT",
          url: "/auth/profile",
          headers: { cookie },
          payload,
        });
      const nameOnly = await put({
        name: "Nome atualizado",
        email: input.email,
      });
      expect(nameOnly.statusCode, nameOnly.body).toBe(200);
      expect(nameOnly.json()).toMatchObject({
        name: "Nome atualizado",
        email: input.email,
        role: "ADMIN",
      });
      expect(
        (
          await put({
            name: "Nome atualizado",
            email: "novo@test.local",
            currentPassword: "senha-incorreta",
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await put({
            name: "Outro",
            email: input.email,
            tenantId: second.id,
            role: "SUPERADMIN",
          })
        ).statusCode,
      ).toBe(400);
      const updated = await put({
        name: "Nome atualizado",
        email: "novo@test.local",
        currentPassword: input.password,
        newPassword: "another-integration-strong-password",
      });
      expect(updated.statusCode, updated.body).toBe(200);
      expect(updated.json().email).toBe("novo@test.local");
      expect(updated.json().passwordHash).toBeUndefined();
      expect(
        (await app.inject({ url: "/auth/session", headers })).statusCode,
      ).toBe(401);
      const renewed = String(updated.headers["set-cookie"]).split(";")[0]!;
      expect(
        (
          await app.inject({
            url: "/auth/session",
            headers: { cookie: renewed },
          })
        ).statusCode,
      ).toBe(200);
      const outside = await app.inject({
        url: "/auth/session",
        headers: { cookie: second.cookie },
      });
      expect(outside.json()).toMatchObject({
        name: input.adminName,
        email: input.email,
        role: "ADMIN",
      });
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          tenant: slug,
          email: "novo@test.local",
          password: "another-integration-strong-password",
        },
      });
      expect(login.statusCode, login.body).toBe(200);
    });
  },
);
