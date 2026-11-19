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
      for (const name of ["Alfa", "Beta"]) {
        const slug = `test-${randomUUID()}`;
        const tenant = await createTenant({ ...input, slug, name });
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
  },
);
