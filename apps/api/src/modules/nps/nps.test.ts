import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { NpsReport } from "@beend/shared";
import { buildApp } from "../../app.js";
import { prisma, tenantDb } from "../../db.js";
import { createTenant } from "../admin/service.js";

const password = "nps integration password";
const suffix = randomUUID().slice(0, 8);
const operatorSlug = `nps-operator-${suffix}`;
const clinicSlug = `nps-clinic-${suffix}`;
const registrySlug = `nps-registry-${suffix}`;
const clinicName = `Clínica NPS ${suffix}`;
const registryName = `Cartório NPS ${suffix}`;
const created: string[] = [];
const app = buildApp(
  {},
  {
    secret: "fixed secret for nps integration tests",
    origin: "http://localhost:5180",
    secure: false,
  },
);

async function session(tenant: string, email: string) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { tenant, email, password },
  });
  expect(response.statusCode, response.body).toBe(200);
  return { cookie: String(response.headers["set-cookie"]).split(";")[0]! };
}
const status = (headers?: { cookie: string }) =>
  app.inject({ url: "/nps/status", headers });
const answer = (headers: { cookie: string }, payload: object) =>
  app.inject({ method: "POST", url: "/nps", headers, payload });

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("NPS survey", () => {
  beforeAll(async () => {
    const operator = await createTenant(
      {
        slug: operatorSlug,
        name: "Beend",
        unitName: "Beend",
        adminName: "Operação",
        email: "operator@beend.local",
        password,
      },
      "SUPERADMIN",
    );
    const clinic = await createTenant({
      slug: clinicSlug,
      name: clinicName,
      unitName: "Unidade",
      adminName: "Gestora",
      email: "admin@clinic.local",
      password,
    });
    const registry = await createTenant({
      slug: registrySlug,
      name: registryName,
      unitName: "Unidade",
      adminName: "Tabelião",
      email: "admin@registry.local",
      password,
    });
    created.push(operator.id, clinic.id, registry.id);
    await tenantDb(clinic.id).user.create({
      data: {
        tenantId: clinic.id,
        name: "Recepção",
        email: "desk@clinic.local",
        role: "ATTENDANT",
        passwordHash: await hash(password, 12),
      },
    });
  });
  afterAll(async () => {
    for (const id of created) await prisma.tenant.delete({ where: { id } });
    await app.close();
    await prisma.$disconnect();
  });

  test("collects one answer per person every 30 days, isolated by company", async () => {
    expect((await status()).statusCode).toBe(401);
    const admin = await session(clinicSlug, "admin@clinic.local");
    const desk = await session(clinicSlug, "desk@clinic.local");
    const other = await session(registrySlug, "admin@registry.local");

    expect((await status(admin)).json()).toEqual({ due: true });
    expect((await answer(admin, { score: 11 })).statusCode).toBe(400);
    const saved = await answer(admin, { score: 9, comment: " Muito bom " });
    expect(saved.statusCode, saved.body).toBe(204);
    expect((await status(admin)).json()).toEqual({ due: false });
    expect((await answer(admin, { score: 10 })).statusCode).toBe(409);

    expect((await status(desk)).json()).toEqual({ due: true });
    expect((await answer(desk, { score: 3 })).statusCode).toBe(204);
    expect((await status(other)).json()).toEqual({ due: true });

    const clinicId = created[1]!;
    await tenantDb(clinicId).npsResponse.updateMany({
      data: { createdAt: new Date(Date.now() - 31 * 86_400_000) },
    });
    expect((await status(admin)).json()).toEqual({ due: true });
  });

  test("shows results only to the Beend operator, who is never asked", async () => {
    const operator = await session(operatorSlug, "operator@beend.local");
    expect((await status(operator)).json()).toEqual({ due: false });
    expect((await answer(operator, { score: 10 })).statusCode).toBe(403);

    const admin = await session(registrySlug, "admin@registry.local");
    expect(
      (await app.inject({ url: "/admin/nps", headers: admin })).statusCode,
    ).toBe(403);
    expect((await answer(admin, { score: 7 })).statusCode).toBe(204);

    const report = await app.inject({
      url: "/admin/nps?days=365",
      headers: operator,
    });
    expect(report.statusCode, report.body).toBe(200);
    const body = report.json<NpsReport>();
    const ours = body.responses.filter(({ companyName }) =>
      [clinicName, registryName].includes(companyName),
    );
    expect(ours).toHaveLength(3);
    expect(ours).toContainEqual(
      expect.objectContaining({
        companyName: clinicName,
        role: "ADMIN",
        score: 9,
        comment: "Muito bom",
      }),
    );
    expect(ours.find(({ score }) => score === 3)?.role).toBe("ATTENDANT");
    expect(JSON.stringify(ours)).not.toMatch(/@|Gestora|Recepção/);

    const recent = await app.inject({
      url: "/admin/nps?days=30",
      headers: operator,
    });
    const recentOurs = recent
      .json<NpsReport>()
      .responses.filter(({ companyName }) =>
        [clinicName, registryName].includes(companyName),
      );
    expect(recentOurs.map(({ score }) => score)).toEqual([7]);
    expect(
      (await app.inject({ url: "/admin/nps?days=7", headers: operator }))
        .statusCode,
    ).toBe(400);
  });
});
