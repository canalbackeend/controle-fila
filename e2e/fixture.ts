import { randomUUID } from "node:crypto";
import {
  expect,
  request as playwrightRequest,
  test as base,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { buildApp } from "../apps/api/src/app";
import { tenantDb } from "../apps/api/src/db";
import { createTenant } from "../apps/api/src/modules/admin/service";

const password = "playwright-strong-password";
const adminEmail = "admin@test.local";

export const test = base.extend<{
  unit: {
    slug: string;
    request: APIRequestContext;
    login: (page: Page, email?: string) => Promise<void>;
  };
}>({
  unit: async ({ baseURL }, use) => {
    const slug = `e2e-${randomUUID()}`;
    const tenant = await createTenant({
      slug,
      name: "Unidade E2E",
      unitName: "Unidade principal",
      adminName: "Administrador",
      email: adminEmail,
      password,
    });
    const db = tenantDb(tenant.id);
    let request: APIRequestContext | undefined;
    try {
      if (!baseURL || !process.env.SESSION_SECRET)
        throw new Error(
          "The Playwright fixture needs a base URL and SESSION_SECRET.",
        );
      const setup = buildApp(
        {},
        {
          secret: process.env.SESSION_SECRET,
          origin: new URL(baseURL).origin,
          secure: baseURL.startsWith("https:"),
        },
      );
      try {
        const authenticated = await setup.inject({
          method: "POST",
          url: "/auth/login",
          payload: { tenant: slug, email: adminEmail, password },
        });
        expect(authenticated.statusCode, authenticated.body).toBe(200);
        const cookie = String(authenticated.headers["set-cookie"]).split(
          ";",
        )[0]!;
        request = await playwrightRequest.newContext({
          baseURL,
          extraHTTPHeaders: { cookie },
        });
      } finally {
        await setup.close();
      }
      const staff = await request.post("/api/admin/users", {
        data: {
          name: "Segundo Atendente",
          email: "staff@test.local",
          role: "ATTENDANT",
          password,
        },
      });
      expect(staff.ok(), await staff.text()).toBeTruthy();
      const applied = await request.post("/api/admin/template", {
        data: { templateId: "clinic" },
      });
      expect(applied.ok(), await applied.text()).toBeTruthy();
      await use({
        slug,
        request,
        login: async (page, email = adminEmail) => {
          await page.goto("/entrar");
          await page.getByLabel("Identificador da empresa").fill(slug);
          await page.getByLabel("E-mail").fill(email);
          await page.getByLabel("Senha", { exact: true }).fill(password);
          await page
            .getByRole("button", { name: "Entrar", exact: true })
            .click();
          await page.waitForURL(
            email === adminEmail ? "**/admin" : "**/atendente",
          );
        },
      });
    } finally {
      await request?.dispose();
      await db.ticketEvent.deleteMany({});
      await db.ticket.deleteMany({});
      await db.queueSequence.deleteMany({});
      await db.counterSession.deleteMany({});
      await db.device.deleteMany({});
      await db.counter.deleteMany({});
      await db.service.deleteMany({});
      await db.tenant.delete({ where: { id: tenant.id } });
    }
  },
});

export { expect };
