import { expect, test } from "./fixture";

test.use({ templateId: "registry" });

test("issues and displays preferential and 80+ registry tickets on separate devices", async ({
  page,
  browser,
  unit,
  baseURL,
}) => {
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
    await tv.getByRole("button", { name: "Toque para iniciar" }).click();
    await page.getByRole("link", { name: "Atendimento", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Guichê", exact: true })
      .selectOption({ label: "Guichê 1" });
    for (const service of ["Reconhecimento de firma", "Registros"]) {
      await page.getByRole("checkbox", { name: service, exact: true }).check();
    }
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
      await expect(waiting.getByText(`${service} · ${priority}`)).toBeVisible();
    }
    for (const code of ["FS002", "FP001", "GS002", "GP001"]) {
      await page.getByRole("button", { name: "Chamar próximo" }).click();
      await expect(page.locator(".current-code")).toHaveText(code);
      await expect(tv.locator(".tv-overlay .tv-call-code")).toHaveText(code, {
        timeout: 10000,
      });
      await page.getByRole("button", { name: "Iniciar atendimento" }).click();
      await page
        .getByRole("button", { name: "Finalizar", exact: true })
        .click();
    }
  } finally {
    await Promise.all([kiosk.close(), tv.close()]);
  }
});
