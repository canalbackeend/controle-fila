import { expect, test } from "./fixture";

test("applies the company theme to existing devices, tracking, sign-in and staff", async ({
  page,
  browser,
  unit,
}) => {
  const devices = await browser.newContext();
  const staff = await browser.newContext();
  try {
    async function pair(type: "KIOSK" | "PANEL") {
      const result = await unit.request.post("/api/admin/devices", {
        data: { name: type, type },
      });
      expect(result.ok(), await result.text()).toBeTruthy();
      const { device, code } = await result.json();
      const screen = await devices.newPage();
      await screen.goto(
        `/${type === "PANEL" ? "painel" : "totem"}/${device.id}`,
      );
      await screen.getByLabel("Código de pareamento").fill(code);
      await screen.getByRole("button", { name: "Parear dispositivo" }).click();
      if (type === "PANEL")
        await screen
          .getByRole("button", { name: "Toque para iniciar" })
          .click();
      else
        await expect(
          screen.getByRole("button", { name: "Recepção" }),
        ).toBeEnabled();
      return screen;
    }
    const [tv, kiosk] = await Promise.all([pair("PANEL"), pair("KIOSK")]);
    const { services } = await (await unit.request.get("/api/admin")).json();
    const issued = await unit.request.post("/api/queue/tickets", {
      data: { serviceId: services[0].id, priority: "NORMAL" },
    });
    expect(issued.ok(), await issued.text()).toBeTruthy();
    const phone = await devices.newPage();
    const { publicToken } = await issued.json();
    await phone.goto(`/t/${publicToken}`);
    await expect(phone.getByText("Aguardando chamada")).toBeVisible();
    const desk = await staff.newPage();
    await unit.login(desk, "staff@test.local");
    const deskAccent = desk.locator(".attendant-title");
    const tvAccent = tv.locator(".tv-header");
    await expect(deskAccent).toHaveCSS(
      "border-inline-start-color",
      "rgb(33, 79, 181)",
    );
    await expect(tvAccent).toHaveCSS("border-bottom-color", "rgb(33, 79, 181)");
    await unit.login(page);
    await page.getByRole("link", { name: "Perfil", exact: true }).click();
    await page.getByRole("radio", { name: "Vermelho", exact: true }).check();
    await page.getByRole("button", { name: "Salvar tema" }).click();
    await expect(page.getByText("Tema da empresa salvo.")).toBeVisible();
    await page.getByRole("link", { name: "Atendimento", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Posto de atendimento" }),
    ).toBeVisible();
    const theme = async (
      surface: typeof page,
      selector: string,
      color: string,
    ) =>
      expect
        .poll(() =>
          surface
            .locator(selector)
            .evaluate((element) =>
              getComputedStyle(element)
                .getPropertyValue("--theme-color")
                .trim()
                .toUpperCase(),
            ),
        )
        .toBe(color);
    await Promise.all([
      theme(page, ".workspace-theme", "#B22540"),
      theme(tv, ".tv-screen", "#B22540"),
      theme(kiosk, ".kiosk", "#B22540"),
      theme(phone, ".tracking", "#B22540"),
      expect(deskAccent).toHaveCSS(
        "border-inline-start-color",
        "rgb(178, 37, 64)",
      ),
      expect(tvAccent).toHaveCSS("border-bottom-color", "rgb(178, 37, 64)"),
    ]);
    await page
      .getByRole("link", { name: "Configurações", exact: true })
      .click();
    await expect(
      page.getByRole("radio", { name: "Vermelho", exact: true }),
    ).toBeChecked();
    await page
      .getByRole("radio", { name: "Personalizado", exact: true })
      .check();
    await page.getByLabel("Código da cor").fill("#7B285A");
    await page.getByRole("button", { name: "Salvar tema" }).click();
    await expect(page.getByText("Tema da empresa salvo.")).toBeVisible();
    await page.reload();
    await theme(page, ".workspace-theme", "#7B285A");
    const signIn = await devices.newPage();
    await signIn.goto(`/entrar?empresa=${unit.slug}`);
    await theme(signIn, ".login", "#7B285A");
    await page.getByRole("link", { name: "Perfil", exact: true }).click();
    await page
      .getByLabel("Nome", { exact: true })
      .fill("Administrador de teste");
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(page.getByText("Perfil salvo.")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Perfil", exact: true }),
    ).toHaveAttribute("data-tooltip", "Perfil · Administrador de teste");
  } finally {
    await devices.close();
    await staff.close();
  }
});

test("an attendant can use a personal theme and return to the company palette", async ({
  page,
  unit,
}) => {
  await unit.login(page, "staff@test.local");
  await page.getByRole("link", { name: "Perfil", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Usar tema da empresa" }),
  ).toBeChecked();
  await page.getByRole("radio", { name: "Verde", exact: true }).check();
  await page.getByRole("button", { name: "Salvar tema" }).click();
  await expect(page.getByText("Tema pessoal salvo.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "Verde", exact: true }),
  ).toBeChecked();
  const appearance = page.locator(".workspace-theme");
  await page.getByRole("link", { name: "Atendimento", exact: true }).click();
  await expect(appearance).toHaveCSS("--theme-color", "#257450");
  const settings = await unit.request
    .get("/api/auth/session")
    .then((response) => response.json());
  expect(settings).toMatchObject({
    theme: { preset: "blue" },
    personalTheme: null,
  });
  await page.getByRole("link", { name: "Perfil", exact: true }).click();
  await page.getByRole("radio", { name: "Usar tema da empresa" }).check();
  await page.getByRole("button", { name: "Salvar tema" }).click();
  await expect(appearance).toHaveCSS("--theme-color", "#214FB5");
});
