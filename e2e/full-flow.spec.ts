import { expect, test } from "./fixture";

test("issues, calls, displays, tracks, forwards and finishes the same ticket", async ({
  page,
  browser,
  unit,
}) => {
  async function register(type: "KIOSK" | "PANEL", name: string) {
    const response = await unit.request.post("/api/admin/devices", {
      data: { name, type },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  }

  const [kiosk, panel] = await Promise.all([
    register("KIOSK", "Totem de entrada"),
    register("PANEL", "TV da unidade"),
  ]);
  const screen = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const desk = await browser.newPage();

  async function pair(target: typeof page, url: string, code: string) {
    await target.goto(url);
    await target.getByLabel("Código de pareamento").fill(code);
    await target.getByRole("button", { name: "Parear dispositivo" }).click();
  }

  try {
    await page.addInitScript(() => {
      window.print = () => {};
    });
    await Promise.all([
      pair(page, `/totem/${kiosk.device.id}`, kiosk.code),
      pair(screen, `/painel/${panel.device.id}`, panel.code),
      unit.login(desk),
    ]);
    await screen.getByRole("button", { name: "Toque para iniciar" }).click();
    await desk.getByRole("link", { name: "Atendimento" }).click();
    await desk
      .getByRole("combobox", { name: "Guichê", exact: true })
      .selectOption({ label: "Recepção" });
    await desk.getByRole("checkbox", { name: "Recepção" }).check();
    await desk.getByRole("checkbox", { name: "Triagem" }).check();
    await desk.getByRole("button", { name: "Iniciar turno" }).click();
    await expect(desk.getByText("Conectado", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Recepção" }).click();
    await page.getByRole("button", { name: "Prioridade 80+" }).click();
    const receipt = page.getByRole("link", { name: "Acompanhar no celular" });
    await expect(receipt).toBeVisible();
    await phone.goto((await receipt.getAttribute("href"))!);
    await expect(phone.getByRole("heading", { name: "RS001" })).toBeVisible();
    await expect(phone.getByText("Aguardando chamada")).toBeVisible();

    await desk.getByRole("button", { name: "Chamar próximo" }).click();
    const overlay = screen.getByRole("region", { name: "Chamada em destaque" });
    await expect(overlay.getByText("RS001")).toBeVisible({ timeout: 1000 });
    await expect(phone.getByText("Chamado", { exact: true })).toBeVisible();
    await desk.getByRole("button", { name: "Iniciar atendimento" }).click();
    await expect(
      phone.getByText("Em atendimento", { exact: true }),
    ).toBeVisible();
    await desk.getByRole("button", { name: "Encaminhar", exact: true }).click();
    await desk
      .getByRole("combobox", { name: "Serviço de destino" })
      .selectOption({ label: "Triagem" });
    await desk
      .getByRole("button", { name: "Confirmar encaminhamento" })
      .click();
    await expect(phone.getByText("Triagem", { exact: true })).toBeVisible();
    await expect(phone.getByText("Aguardando chamada")).toBeVisible();

    await desk.getByRole("button", { name: "Chamar próximo" }).click();
    await expect(desk.locator(".current-code")).toHaveText("RS001");
    await desk.getByRole("button", { name: "Iniciar atendimento" }).click();
    await desk.getByRole("button", { name: "Finalizar", exact: true }).click();
    await expect(phone.getByText("Finalizado", { exact: true })).toBeVisible();
    await desk.getByRole("link", { name: "Relatórios" }).click();
    await expect(
      desk.getByRole("row").filter({ hasText: "Recepção" }),
    ).toBeVisible();
    await expect(
      desk.getByRole("row").filter({ hasText: "Triagem" }),
    ).toBeVisible();
    const downloaded = desk.waitForEvent("download");
    await desk.getByRole("link", { name: "Exportar CSV" }).click();
    expect((await downloaded).suggestedFilename()).toMatch(
      /^beend-fila-.*\.csv$/,
    );
  } finally {
    await Promise.all([screen.close(), phone.close(), desk.close()]);
  }
});
