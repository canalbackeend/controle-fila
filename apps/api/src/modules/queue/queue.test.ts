import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { localDay, type Actor } from "@beend/shared";
import { buildApp } from "../../app.js";
import { prisma, tenantDb } from "../../db.js";
import { createTenant } from "../admin/service.js";
import { expireQueue } from "./service.js";

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("queue transactions", () => {
  const app = buildApp(
    {},
    {
      secret: "fixed secret for integration tests",
      origin: "http://localhost:5180",
      secure: false,
    },
  );
  const tenants: string[] = [];
  const accounts: { actor: Actor; cookie: string }[] = [];
  const fixtures: { first: string; second: string; target: string }[] = [];
  const password = "integration-test-strong-password";

  beforeAll(async () => {
    for (const index of [0, 1]) {
      const slug = `queue-${randomUUID()}`;
      const email = "admin@test.local";
      const tenant = await createTenant({
        name: "Fila de teste",
        unitName: "Unidade de teste",
        adminName: "Atendente",
        password,
        slug,
        email,
      });
      tenants.push(tenant.id);
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { tenant: slug, email, password },
      });
      expect(login.statusCode, login.body).toBe(200);
      const actor = login.json<Actor>();
      accounts.push({
        actor,
        cookie: String(login.headers["set-cookie"]).split(";")[0]!,
      });
      const db = tenantDb(tenant.id);
      const scope = { tenantId: tenant.id, unitId: actor.unitId };
      const first = await db.service.create({
        data: {
          ...scope,
          name: "Recepção",
          prefix: "R",
          preferentialPrefix: "RP",
          priority80Prefix: "RI",
          callMode: "NAME",
        },
      });
      const second = await db.service.create({
        data: {
          ...scope,
          name: "Triagem",
          prefix: "T",
          preferentialPrefix: "TP",
          priority80Prefix: "TI",
          stageOrder: 2,
        },
      });
      const counter = await db.counter.create({
        data: { ...scope, name: "Guichê 1", number: 1 },
      });
      fixtures.push({ first: first.id, second: second.id, target: counter.id });
      await db.counterSession.create({
        data: {
          ...scope,
          userId: actor.id,
          counterId: counter.id,
          serviceIds: [first.id, second.id],
        },
      });
      if (index === 0) {
        const created = await app.inject({
          method: "POST",
          url: "/admin/users",
          headers: { cookie: accounts[0]!.cookie },
          payload: {
            name: "Segundo",
            email: "second@test.local",
            password,
            role: "ATTENDANT",
          },
        });
        expect(created.statusCode, created.body).toBe(201);
        const secondLogin = await app.inject({
          method: "POST",
          url: "/auth/login",
          payload: { tenant: slug, email: "second@test.local", password },
        });
        expect(secondLogin.statusCode, secondLogin.body).toBe(200);
        const secondActor = secondLogin.json<Actor>();
        const secondCounter = await db.counter.create({
          data: { ...scope, name: "Guichê 2", number: 2 },
        });
        await db.counterSession.create({
          data: {
            ...scope,
            userId: secondActor.id,
            counterId: secondCounter.id,
            serviceIds: [first.id],
          },
        });
        accounts.push({
          actor: secondActor,
          cookie: String(secondLogin.headers["set-cookie"]).split(";")[0]!,
        });
      }
    }
  }, 12000);

  afterAll(async () => {
    for (const id of tenants) {
      const db = tenantDb(id);
      await db.ticketEvent.deleteMany({});
      await db.ticket.deleteMany({});
      await db.queueSequence.deleteMany({});
      await db.counterSession.deleteMany({});
      await db.counter.deleteMany({});
      await db.service.deleteMany({});
      await db.tenant.delete({ where: { id } });
    }
    await app.close();
    await prisma.$disconnect();
  });

  test("issues 50 unique tickets, claims different tickets concurrently, and preserves priority on transfer", async () => {
    const { actor, cookie } = accounts[0]!;
    const other = accounts[1]!;
    const foreign = accounts[2]!;
    const { first, second, target } = fixtures[0]!;
    const issue = (
      serviceId: string,
      priority: string,
      customerName?: string,
      requestCookie = cookie,
    ) =>
      app.inject({
        method: "POST",
        url: "/queue/tickets",
        headers: { cookie: requestCookie },
        payload: { serviceId, priority, customerName },
      });
    const updates = (
      id: string,
      action: string,
      payload: object = {},
      requestCookie = cookie,
    ) =>
      app.inject({
        method: "POST",
        url: `/queue/tickets/${id}/action`,
        headers: { cookie: requestCookie },
        payload: { action, ...payload },
      });
    expect(
      (await issue(first, "NORMAL", undefined, foreign.cookie)).statusCode,
    ).toBe(404);
    const responses = await Promise.all(
      Array.from({ length: 50 }, (_, index) =>
        issue(
          first,
          index === 0 ? "PRIORITY80" : "NORMAL",
          index === 0 ? "Maria Souza Lima" : undefined,
        ),
      ),
    );
    for (const response of responses)
      expect(response.statusCode, response.body).toBe(201);
    const tickets = responses.map((response) => response.json());
    expect(new Set(tickets.map(({ code }) => code)).size).toBe(50);
    expect(
      tickets
        .map(({ code }) => Number(code.match(/\d+$/)[0]))
        .sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));
    expect(JSON.stringify(tickets)).not.toContain("Maria");
    const publicResponse = await app.inject(`/track/${tickets[0].publicToken}`);
    expect(publicResponse.statusCode, publicResponse.body).toBe(200);
    expect(publicResponse.headers["cache-control"]).toContain("no-store");
    expect(Object.keys(publicResponse.json()).sort()).toEqual([
      "code",
      "peopleAhead",
      "service",
      "status",
      "unitName",
    ]);
    expect(publicResponse.body).not.toContain("Maria");
    expect((await app.inject(`/track/${"a".repeat(32)}`)).statusCode).toBe(404);

    const stats = await app.inject({
      url: "/queue/stats",
      headers: { cookie: foreign.cookie },
    });
    expect(
      stats.json().map((stat: { waiting: number }) => stat.waiting),
    ).toEqual([0, 0]);

    const call = (requestCookie: string, code?: string) =>
      app.inject({
        method: "POST",
        url: "/queue/call",
        headers: { cookie: requestCookie },
        payload: { code },
      });
    expect((await call(foreign.cookie, tickets[0].code)).statusCode).toBe(404);
    const calls = await Promise.all([call(cookie), call(other.cookie)]);
    for (const result of calls)
      expect(result.statusCode, result.body).toBe(200);
    expect(calls[0]!.json().id).not.toEqual(calls[1]!.json().id);
    expect(
      (await updates(calls[0]!.json().id, "NO_SHOW", {}, foreign.cookie))
        .statusCode,
    ).toBe(404);
    expect((await updates(calls[0]!.json().id, "NO_SHOW")).statusCode).toBe(
      200,
    );
    const selected = await call(cookie, tickets[0].code);
    expect(selected.statusCode, selected.body).toBe(200);
    expect(selected.json().displayName).toBe("Maria S.");
    const id = selected.json().id;
    expect((await updates(id, "RECALL")).statusCode).toBe(200);
    expect((await updates(id, "START")).statusCode).toBe(200);
    expect(
      (await updates(id, "FORWARD", { serviceId: fixtures[1]!.first }))
        .statusCode,
    ).toBe(404);
    const moved = await updates(id, "FORWARD", {
      serviceId: second,
      counterId: target,
    });
    expect(moved.statusCode, moved.body).toBe(200);
    expect(moved.json()).toMatchObject({
      id,
      status: "WAITING",
      code: tickets[0].code,
      serviceId: second,
      priority: "PRIORITY80",
      targetCounterId: target,
    });
    expect((await call(cookie, tickets[0].code)).statusCode).toBe(200);
    expect((await updates(id, "START")).statusCode).toBe(200);
    expect((await updates(id, "FINISH")).statusCode).toBe(200);
    const db = tenantDb(actor.tenantId);
    const events = await db.ticketEvent.findMany({
      where: { ticketId: id },
      orderBy: { at: "asc" },
    });
    expect(events.map(({ type }) => type)).toEqual(
      expect.arrayContaining([
        "ISSUED",
        "CALLED",
        "RECALLED",
        "STARTED",
        "FORWARDED",
        "QUEUED",
        "FINISHED",
      ]),
    );
    expect(events).toHaveLength(9);
    const day = localDay(new Date(), actor.timeZone);
    const reportUrl = `/reports?from=${day}&to=${day}`;
    const ownReport = await app.inject({ url: reportUrl, headers: { cookie } });
    expect(ownReport.statusCode, ownReport.body).toBe(200);
    expect(ownReport.json().metrics).toMatchObject({
      completed: 2,
      noShows: 1,
      noShowRate: 33.3,
    });
    expect(
      ownReport
        .json()
        .hours.reduce((sum: number, count: number) => sum + count, 0),
    ).toBe(3);
    const filtered = await app.inject({
      url: reportUrl + "&serviceId=" + second,
      headers: { cookie },
    });
    expect(filtered.json().metrics).toMatchObject({ completed: 1, noShows: 0 });
    const foreignReport = await app.inject({
      url: reportUrl,
      headers: { cookie: foreign.cookie },
    });
    expect(foreignReport.json().metrics).toMatchObject({
      completed: 0,
      noShows: 0,
    });
    expect(
      (
        await app.inject({
          url: reportUrl + "&serviceId=" + second,
          headers: { cookie: foreign.cookie },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ url: reportUrl, headers: { cookie: other.cookie } }))
        .statusCode,
    ).toBe(403);
    const csv = await app.inject({
      url: reportUrl.replace("/reports?", "/reports.csv?"),
      headers: { cookie },
    });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.body).toContain('"Triagem"');
    expect(csv.body).not.toContain("Maria");
  }, 15000);

  test("expires only the waiting tickets of the selected tenant after the local reset and records the event", async () => {
    const { actor } = accounts[0]!;
    const { actor: foreign } = accounts[2]!;
    const create = async (scope: Actor, serviceId: string) =>
      tenantDb(scope.tenantId).ticket.create({
        data: {
          tenantId: scope.tenantId,
          unitId: scope.unitId,
          issuedServiceId: serviceId,
          serviceId,
          businessDate: "2020-01-01",
          priority: "NORMAL",
          number: 1,
          code: "R001",
          publicToken: randomUUID().replaceAll("-", ""),
        },
      });
    const own = await create(actor, fixtures[0]!.first);
    const expired = await app.inject(`/track/${own.publicToken}`);
    expect(expired.statusCode).toBe(410);
    expect(expired.body).not.toContain("R001");

    const other = await create(foreign, fixtures[1]!.first);
    const scope = { ...actor, resetTime: "05:00" };
    expect(await expireQueue(scope, new Date("2020-01-02T07:59:59Z"))).toBe(0);
    expect(await expireQueue(scope, new Date("2020-01-02T08:00:00Z"))).toBe(1);
    expect(
      (
        await tenantDb(actor.tenantId).ticket.findUniqueOrThrow({
          where: { id: own.id },
          include: { events: true },
        })
      ).events[0]?.type,
    ).toBe("CANCELED");
    expect(
      (
        await tenantDb(foreign.tenantId).ticket.findUniqueOrThrow({
          where: { id: other.id },
        })
      ).status,
    ).toBe("WAITING");
  });
});
