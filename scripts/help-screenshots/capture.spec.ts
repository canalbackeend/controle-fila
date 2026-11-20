import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import { buildApp } from "../../apps/api/src/app";
import { prisma, tenantDb } from "../../apps/api/src/db";
import { createTenant } from "../../apps/api/src/modules/admin/service";
import {
  helpFigures,
  type HelpFigureId,
} from "../../apps/web/src/pages/help/figures";

/*
 * Builds a fictional clinic, walks through each screen and saves annotated
 * screenshots for the help center. All data is removed at the end.
 */
const output = resolve(import.meta.dirname, "../../apps/web/public/help");
const password = "help screenshots password 2026";
const suffix = randomUUID().slice(0, 6);
const clinicSlug = `clinica-bem-estar-${suffix}`;
const beendSlug = `beend-manual-${suffix}`;
const admin = { name: "Ana Ribeiro", email: "ana@clinica-bemestar.test" };
const hideWidgets = `.nps { display: none !important; }`;

async function session(baseURL: string, slug: string, email: string) {
  const app = buildApp(
    {},
    {
      secret: process.env.SESSION_SECRET!,
      origin: new URL(baseURL).origin,
      secure: false,
    },
  );
  try {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { tenant: slug, email, password },
    });
    expect(login.statusCode, login.body).toBe(200);
    return playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: {
        cookie: String(login.headers["set-cookie"]).split(";")[0]!,
      },
    });
  } finally {
    await app.close();
  }
}

async function ok(response: Promise<APIResponse>) {
  const result = await response;
  expect(result.ok(), await result.text()).toBeTruthy();
  return result;
}

async function signIn(page: Page, slug: string, email: string) {
  await page.goto(`/entrar?empresa=${slug}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
}

async function shoot(
  page: Page,
  id: HelpFigureId,
  targets: Locator[] = [],
  options: { fullPage?: boolean } = {},
) {
  const figure = helpFigures[id];
  expect(targets, `marks of ${id}`).toHaveLength(
    "marks" in figure ? figure.marks.length : 0,
  );
  await page.addStyleTag({ content: hideWidgets });
  await page.mouse.move(0, 0);
  const boxes = [];
  for (const target of targets) {
    await expect(target).toBeVisible();
    const box = await target.boundingBox();
    expect(box, `box of a mark in ${id}`).not.toBeNull();
    boxes.push(box!);
  }
  await page.evaluate((boxes) => {
    // Marks grow with wide screens (TV) so they stay readable once scaled down.
    const size = Math.max(28, Math.round(window.innerWidth / 42));
    const stroke = Math.max(3, Math.round(size / 9));
    const offset = -Math.round(size / 2);
    boxes.forEach((box, index) => {
      const frame = document.createElement("div");
      frame.className = "help-mark";
      const left = Math.max(2, box.x + window.scrollX - 5);
      const top = Math.max(2, box.y + window.scrollY - 5);
      const right = Math.min(
        document.documentElement.scrollWidth - 2,
        box.x + window.scrollX + box.width + 5,
      );
      Object.assign(frame.style, {
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${right - left}px`,
        height: `${box.y + window.scrollY + box.height + 5 - top}px`,
        border: `${stroke}px solid #0b82ff`,
        borderRadius: "10px",
        boxShadow: `0 0 0 ${stroke + 2}px rgb(11 130 255 / 0.18)`,
        pointerEvents: "none",
        zIndex: "9999",
      });
      const badge = document.createElement("span");
      badge.textContent = String(index + 1);
      Object.assign(badge.style, {
        position: "absolute",
        top: `${Math.max(offset, 4 - top)}px`,
        left: `${Math.max(offset, 4 - left)}px`,
        display: "grid",
        placeItems: "center",
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: "#0b82ff",
        color: "#fff",
        font: `800 ${Math.round(size * 0.55)}px 'Inter Variable', system-ui, sans-serif`,
        boxShadow: "0 4px 10px rgb(0 0 0 / 0.2)",
      });
      frame.append(badge);
      document.body.append(frame);
    });
  }, boxes);
  await page.screenshot({
    path: resolve(output, figure.file),
    type: "jpeg",
    quality: 82,
    fullPage: options.fullPage,
  });
  await page.evaluate(() =>
    document.querySelectorAll(".help-mark").forEach((mark) => mark.remove()),
  );
}

async function devicePage(
  browser: Browser,
  width: number,
  height: number,
  permissions: string[] = [],
) {
  const context = await browser.newContext({
    viewport: { width, height },
    permissions,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  await context.addInitScript(() => {
    window.print = () => {};
  });
  return { context, page: await context.newPage() };
}

test("captures the illustrated help center", async ({ browser, baseURL }) => {
  const clinic = await createTenant({
    slug: clinicSlug,
    name: "Clínica Bem-Estar",
    unitName: "Unidade Centro",
    adminName: admin.name,
    email: admin.email,
    password,
  });
  const beend = await createTenant(
    {
      slug: beendSlug,
      name: "Beend",
      unitName: "Beend",
      adminName: "Operação Beend",
      email: "operacao@beend.test",
      password,
    },
    "SUPERADMIN",
  );
  let api: APIRequestContext | undefined;
  const contexts: { close(): Promise<void> }[] = [];
  try {
    api = await session(baseURL!, clinicSlug, admin.email);
    await ok(
      api.post("/api/admin/template", { data: { templateId: "clinic" } }),
    );
    for (const [name, email] of [
      ["Carlos Lima", "carlos@clinica-bemestar.test"],
      ["Juliana Prado", "juliana@clinica-bemestar.test"],
    ])
      await ok(
        api.post("/api/admin/users", {
          data: { name, email, role: "ATTENDANT", password },
        }),
      );
    for (const card of [
      {
        type: "NOTICE",
        title: "Campanha de vacinação",
        text: "Vacina da gripe disponível de segunda a sexta, das 8h às 17h.",
      },
      {
        type: "TIP",
        title: "Beba água",
        text: "Manter-se hidratado ajuda o corpo a funcionar melhor.",
      },
    ])
      await ok(api.post("/api/admin/cards", { data: card }));
    const tv = await (
      await ok(
        api.post("/api/admin/devices", {
          data: { name: "TV da recepção", type: "PANEL" },
        }),
      )
    ).json();
    const kiosk = await (
      await ok(
        api.post("/api/admin/devices", {
          data: { name: "Totem da entrada", type: "KIOSK" },
        }),
      )
    ).json();
    const panelSettings = {
      serviceIds: [],
      weights: { NOTICE: 60, NEWS: 0, WEATHER: 0, TIP: 40 },
      cardSeconds: 30,
      city: "Brasília",
      state: "DF",
      callDisplaySeconds: 5,
      callSound: "VOICE",
      ticker:
        "Bem-vindo à Clínica Bem-Estar! Tenha seus documentos e a carteirinha do convênio em mãos.",
    };
    await ok(
      api.put(`/api/admin/panels/${tv.device.id}`, { data: panelSettings }),
    );

    const { context: staffContext, page } = await devicePage(
      browser,
      1280,
      820,
    );
    contexts.push(staffContext);
    await signIn(page, clinicSlug, admin.email);

    await expect(
      page.getByText("Recepção", { exact: true }).first(),
    ).toBeVisible();
    await shoot(page, "adminServices", [
      page.getByRole("navigation", { name: "Áreas da administração" }),
      page.getByRole("button", { name: "Adicionar serviço" }),
      page.getByRole("button", { name: "Editar" }).first(),
    ]);
    await page.getByRole("button", { name: "Equipe" }).click();
    await expect(page.getByText("Carlos Lima")).toBeVisible();
    await shoot(page, "adminTeam", [
      page.getByRole("button", { name: "Equipe" }),
      page.getByRole("button", { name: "Adicionar usuário" }),
      page.getByRole("button", { name: "Editar" }).nth(1),
    ]);

    await page.goto("/admin/conteudo");
    await expect(page.getByText("Campanha de vacinação")).toBeVisible();
    await shoot(page, "content", [
      page.locator("section", {
        has: page.getByRole("heading", { name: "Logotipo da TV" }),
      }),
      page.getByRole("button", { name: "Adicionar conteúdo" }),
      page.getByText("Campanha de vacinação").locator(".."),
    ]);

    const kioskScreen = await devicePage(browser, 1024, 768);
    contexts.push(kioskScreen.context);
    const totem = kioskScreen.page;
    await totem.goto(`/totem/${kiosk.device.id}?impressao=manual`);
    await totem.getByLabel("Código de pareamento").fill(kiosk.code);
    await totem.getByRole("button", { name: "Parear dispositivo" }).click();
    await expect(totem.getByRole("button", { name: "Recepção" })).toBeEnabled();
    await shoot(totem, "kioskServices");
    await totem.getByRole("button", { name: "Recepção" }).click();
    await shoot(totem, "kioskPriority");
    await totem.getByRole("button", { name: "Normal" }).click();
    await expect(
      totem.getByAltText("QR Code de acompanhamento da senha"),
    ).toBeVisible();
    await shoot(totem, "kioskReceipt");

    await page.goto("/atendente");
    await expect(page.getByText("Escolha o guichê")).toBeVisible();
    const shift = page.locator("section", {
      has: page.getByRole("heading", { name: "Meu turno" }),
    });
    await shoot(page, "attendantShift", [
      shift.getByLabel("Guichê"),
      shift.locator("fieldset", { hasText: "Serviços atendidos" }),
      shift.getByRole("button", { name: "Marcar todos os serviços" }),
      shift.getByRole("button", { name: "Iniciar turno" }),
    ]);
    await shift.getByLabel("Guichê").selectOption({ index: 1 });
    await shift
      .getByRole("button", { name: "Marcar todos os serviços" })
      .click();
    await shift.getByRole("button", { name: "Iniciar turno" }).click();
    await expect(
      page.getByRole("button", { name: /Chamar próximo/ }),
    ).toBeVisible();

    const state = await (await ok(api.get("/api/attendant"))).json();
    const [reception, triage, office] = state.services;
    const issued = [];
    for (const [service, priority] of [
      [reception, "PRIORITY80"],
      [reception, "NORMAL"],
      [triage, "PREFERENTIAL"],
      [office, "NORMAL"],
      [reception, "NORMAL"],
      [triage, "NORMAL"],
    ] as const)
      issued.push(
        await (
          await ok(
            api.post("/api/queue/tickets", {
              data: { serviceId: service.id, priority },
            }),
          )
        ).json(),
      );

    const tvScreen = await devicePage(browser, 1920, 1080);
    contexts.push(tvScreen.context);
    const tvPage = tvScreen.page;
    await tvPage.goto(`/painel/${tv.device.id}`);
    await tvPage.getByLabel("Código de pareamento").fill(tv.code);
    await tvPage.getByRole("button", { name: "Parear dispositivo" }).click();
    await tvPage.getByRole("button", { name: "Toque para iniciar" }).click();
    await expect(
      tvPage
        .getByText("Campanha de vacinação")
        .or(tvPage.getByText("Beba água"))
        .first(),
    ).toBeVisible();

    for (let round = 0; round < 3; round++) {
      await page.getByRole("button", { name: /Chamar próximo/ }).click();
      await expect(
        page.getByRole("button", { name: /Iniciar atendimento/ }),
      ).toBeVisible();
      if (round === 2) break;
      await page.getByRole("button", { name: /Iniciar atendimento/ }).click();
      await page.getByRole("button", { name: /Finalizar/ }).click();
      await expect(
        page.getByRole("button", { name: /Chamar próximo/ }),
      ).toBeVisible();
    }
    const overlay = tvPage.getByRole("region", { name: "Chamada em destaque" });
    await expect(overlay).toBeVisible();
    await shoot(tvPage, "tvCall");
    await shoot(page, "attendantCall", [
      page.locator("section", {
        has: page.getByRole("heading", { name: "Senha atual" }),
      }),
      page.locator("section", {
        has: page.getByRole("heading", { name: "Filas do guichê" }),
      }),
      page.locator("section", {
        has: page.getByRole("heading", { name: "Senhas aguardando" }),
      }),
      page.locator("section", {
        has: page.getByRole("heading", { name: "Emissão no balcão" }),
      }),
    ]);
    await expect(overlay).toHaveCount(0, { timeout: 20_000 });
    await expect(tvPage.locator(".tv-current")).toBeVisible();
    await shoot(tvPage, "tvIdle", [
      tvPage.locator(".tv-current"),
      tvPage.locator(".tv-queue ul"),
      tvPage.locator(".tv-layout > .tv-card"),
      tvPage.locator(".tv-ticker"),
    ]);

    await page.getByRole("button", { name: /Não compareceu/ }).click();
    const waiting = issued.at(-1);
    const { context: phoneContext, page: phone } = await devicePage(
      browser,
      390,
      844,
    );
    // Show the phone as most people first see it: notifications not decided yet.
    await phoneContext.addInitScript(() => {
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: class {
          static permission = "default";
          static requestPermission = async () => "default";
        },
      });
    });
    contexts.push(phoneContext);
    await phone.goto(`/t/${waiting.publicToken}`);
    await expect(phone.getByText(waiting.code)).toBeVisible();
    await shoot(phone, "tracking");

    await page.goto("/admin/relatorios");
    await expect(
      page.getByRole("heading", { name: "Por serviço e atendente" }),
    ).toBeVisible();
    await shoot(page, "reports", [
      page.locator("form").first(),
      page.getByRole("link", { name: /Exportar CSV/ }),
      page.locator(".report-metrics"),
    ]);

    await page.goto("/perfil");
    await shoot(page, "profile", [
      page
        .locator("section", {
          has: page.getByRole("heading", { name: "Dados da conta" }),
        })
        .locator("form")
        .first(),
      page.locator("label", { hasText: "Alterar senha" }),
    ]);

    await page.goto(`/admin/painel/${tv.device.id}`);
    await expect(
      page.getByRole("button", { name: "Salvar painel" }),
    ).toBeVisible();
    await shoot(
      page,
      "tvSettings",
      [
        page.locator("fieldset", { hasText: "Serviços exibidos" }),
        page.locator("fieldset", { hasText: "Pesos do carrossel" }),
        page.locator("fieldset", { hasText: "Som da chamada" }),
        page.getByRole("button", { name: "Salvar painel" }),
      ],
      { fullPage: true },
    );

    await page.goto("/admin/dispositivos");
    await expect(page.getByText("Totem da entrada")).toBeVisible();
    await shoot(
      page,
      "devices",
      [
        page.locator("section", {
          has: page.getByRole("heading", { name: "Cadastrar dispositivo" }),
        }),
        page.getByRole("link", { name: /Configurar TV e clima/ }),
        page.getByRole("button", { name: /Novo código/ }).first(),
      ],
      { fullPage: true },
    );

    const db = tenantDb(clinic.id);
    const people = await db.user.findMany({ orderBy: { name: "asc" } });
    const answers = [
      [admin.name, 9, "A TV deixou a recepção muito mais organizada."],
      ["Carlos Lima", 10, "Chamar pelo teclado ficou rápido."],
      ["Juliana Prado", 7, "Gostaria de relatórios por semana."],
    ] as const;
    for (const [name, score, comment] of answers) {
      const person = people.find((user) => user.name === name)!;
      await db.npsResponse.create({
        data: {
          tenantId: clinic.id,
          userId: person.id,
          role: person.role === "ATTENDANT" ? "ATTENDANT" : "ADMIN",
          score,
          comment,
        },
      });
    }
    const { context: beendContext, page: operator } = await devicePage(
      browser,
      1280,
      820,
    );
    contexts.push(beendContext);
    await signIn(operator, beendSlug, "operacao@beend.test");
    await expect(
      operator.getByRole("heading", { name: "Empresas cadastradas" }),
    ).toBeVisible();
    await shoot(operator, "platformCompanies", [
      operator.getByRole("button", { name: "Cadastrar empresa" }),
      operator.getByRole("button", { name: /Editar plano e limites/ }).first(),
    ]);
    await operator.goto("/plataforma/satisfacao");
    await expect(operator.getByText("A TV deixou a recepção")).toBeVisible();
    await shoot(operator, "platformSatisfaction", [
      operator.getByRole("region", { name: "Resumo do NPS" }),
      operator.locator("section", {
        has: operator.getByRole("heading", { name: "Respostas" }),
      }),
    ]);
  } finally {
    for (const context of contexts) await context.close();
    await api?.dispose();
    for (const id of [clinic.id, beend.id]) {
      const db = tenantDb(id);
      await db.ticketEvent.deleteMany({});
      await db.ticket.deleteMany({});
      await db.queueSequence.deleteMany({});
      await db.counterSession.deleteMany({});
      await db.device.deleteMany({});
      await db.counter.deleteMany({});
      await db.service.deleteMany({});
      await db.card.deleteMany({});
      await prisma.tenant.delete({ where: { id } });
    }
    await prisma.$disconnect();
  }
});
