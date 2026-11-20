import { expect, test } from "./fixture";

test.use({ templateId: "registry" });

test("issues and displays preferential and 80+ registry tickets on separate devices", async ({
  page,
  browser,
  unit,
  baseURL,
}) => {
  test.setTimeout(55_000);
  const kiosk = await browser.newPage({ baseURL });
  const tv = await browser.newPage({ baseURL });
  try {
    async function pair(screen: typeof page, type: "KIOSK" | "PANEL") {
      const response = await unit.request.post("/api/admin/devices", {
        data: { name: type, type },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      const { device, code } = await response.json();
      await screen.goto(
        `/${type === "KIOSK" ? "totem" : "painel"}/${device.id}`,
      );
      await screen.getByLabel("Código de pareamento").fill(code);
      await screen.getByRole("button", { name: "Parear dispositivo" }).click();
    }
    await Promise.all([
      pair(kiosk, "KIOSK"),
      pair(tv, "PANEL"),
      unit.login(page),
    ]);
    await kiosk
      .getByRole("button", { name: "Tela cheia", exact: true })
      .click();
    await expect(
      kiosk.getByRole("button", { name: "Sair da tela cheia" }),
    ).toBeVisible();
    await kiosk.getByRole("button", { name: "Sair da tela cheia" }).click();
    await expect(
      kiosk.getByRole("button", { name: "Tela cheia", exact: true }),
    ).toBeVisible();
    await tv.getByRole("button", { name: "Tela cheia", exact: true }).click();
    await expect(
      tv.getByRole("button", { name: "Sair da tela cheia" }),
    ).toBeVisible();
    await tv.getByRole("button", { name: "Toque para iniciar" }).click();
    await tv.getByRole("button", { name: "Sair da tela cheia" }).click();
    await expect(
      tv.getByRole("button", { name: "Tela cheia", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Guichês", exact: true }).click();
    await page.getByRole("link", { name: "Gerenciar meu turno" }).click();
    await expect(
      page.getByRole("heading", { name: "Meu turno" }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Guichê", exact: true })
      .selectOption({ label: "Guichê 1" });
    await page
      .getByRole("checkbox", { name: "Reconhecimento de firma", exact: true })
      .check();
    await page.getByRole("button", { name: "Iniciar turno" }).click();

    for (const [service, priority, code] of [
      ["Reconhecimento de firma", "Preferencial", "FP001"],
      ["Reconhecimento de firma", "Prioridade 80+", "FS002"],
      ["Registros", "Preferencial", "GP001"],
      ["Registros", "Prioridade 80+", "GS002"],
    ]) {
      await kiosk.getByRole("button", { name: service, exact: true }).click();
      await kiosk.getByRole("button", { name: priority, exact: true }).click();
      await expect(
        kiosk.getByRole("heading", { name: code, exact: true }),
      ).toBeVisible();
      await kiosk.getByRole("button", { name: "Concluir" }).click();
      const waiting = page.getByRole("listitem").filter({ hasText: code });
      if (service === "Reconhecimento de firma")
        await expect(
          waiting.getByText(`${service} · ${priority}`),
        ).toBeVisible();
      else await expect(waiting).toHaveCount(0);
    }
    for (const code of ["FS002", "GS002", "FP001", "GP001"]) {
      await page.getByRole("button", { name: "Chamar próximo" }).click();
      await expect(page.locator(".current-code")).toHaveText(code);
      await expect(tv.locator(".tv-overlay .tv-call-code")).toHaveText(code, {
        timeout: 10000,
      });
      if (code === "FS002") {
        await expect(
          page.getByRole("button", { name: "Encerrar turno" }),
        ).toBeDisabled();
        await page.getByRole("button", { name: "Alterar serviços" }).click();
        await expect(
          page.getByRole("checkbox", {
            name: "Reconhecimento de firma",
            exact: true,
          }),
        ).toBeChecked();
        await page
          .getByRole("button", { name: "Marcar todos os serviços" })
          .click();
        await page.getByRole("button", { name: "Salvar serviços" }).click();
        await expect(
          page.getByRole("button", { name: "Alterar serviços" }),
        ).toBeVisible();
        await expect(page.locator(".current-code")).toHaveText(code);
        await expect(
          page.getByText("Registros · Prioridade 80+", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("Registros · Preferencial", { exact: true }),
        ).toBeVisible();
      }
      await page.getByRole("button", { name: "Iniciar atendimento" }).click();
      await page
        .getByRole("button", { name: "Finalizar", exact: true })
        .click();
    }
    await page.getByRole("button", { name: "Encerrar turno" }).click();
    await expect(
      page.getByText("Sem turno aberto", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Guichê", exact: true })
      .selectOption({ label: "Guichê 2" });
    await page
      .getByRole("button", { name: "Marcar todos os serviços" })
      .click();
    await page.getByRole("button", { name: "Iniciar turno" }).click();
    await expect(page.getByText("Turno aberto", { exact: true })).toBeVisible();
  } finally {
    await Promise.all([kiosk.close(), tv.close()]);
  }
});
