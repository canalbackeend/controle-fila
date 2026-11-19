import { randomUUID } from "node:crypto";
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
  },
);
