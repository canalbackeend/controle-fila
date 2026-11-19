import { expect, test } from "./fixture";

test.use({ actionTimeout: 10000 });

test("resets the attendant session and releases an occupied desk from administration", async ({
  page,
  browser,
  unit,
}) => {
  const desk = await browser.newPage();
  try {
    await unit.login(desk, "staff@test.local");
    const startAtReception = async (operator: typeof page) => {
      await operator
        .getByRole("combobox", { name: "Guichê", exact: true })
        .selectOption({ label: "Recepção" });
      await operator
        .getByRole("checkbox", { name: "Recepção", exact: true })
        .check();
      await operator.getByRole("button", { name: "Iniciar turno" }).click();
      await expect(
        operator.getByRole("heading", { name: "Senha atual" }),
      ).toBeVisible();
    };
    await startAtReception(desk);
    await expect(desk.getByText("Conectado", { exact: true })).toBeVisible();
    const { services } = await (await unit.request.get("/api/admin")).json();
    const issued = await unit.request.post("/api/queue/tickets", {
      data: { serviceId: services[0].id, priority: "PRIORITY80" },
    });
    expect(issued.ok(), await issued.text()).toBeTruthy();
    const { code } = await issued.json();
    await desk.getByRole("button", { name: "Chamar próximo" }).click();
    await desk.getByRole("button", { name: "Iniciar atendimento" }).click();
    await expect(desk.getByRole("button", { name: "Finalizar" })).toBeVisible();

    await unit.login(page);
    await page.getByRole("button", { name: "Equipe", exact: true }).click();
    const member = page
      .getByRole("listitem")
      .filter({ hasText: "Segundo Atendente" });
    await member.getByRole("button", { name: "Editar", exact: true }).click();
    await page
      .getByLabel("Senha com ao menos 12 caracteres")
      .fill("new-team-password-for-tests");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Alterações salvas.")).toBeVisible();
    await expect(desk).toHaveURL(/\/entrar$/);
    expect((await desk.request.get("/api/auth/session")).status()).toBe(401);

    await member
      .getByRole("button", { name: "Desativar", exact: true })
      .click();
    await expect(member.getByText("Inativo", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Guichês", exact: true }).click();
    const counter = page
      .getByRole("listitem")
      .filter({ hasText: "Turno aberto · Segundo Atendente" });
    await counter.getByRole("button", { name: "Liberar guichê" }).click();
    await expect(
      page.getByText(`Senha ${code} · Em atendimento`),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "O que fazer com a senha?", exact: true })
      .selectOption("REQUEUE");
    await page.getByRole("button", { name: "Confirmar liberação" }).click();
    await expect(
      page.getByText("Turno encerrado. Guichê liberado."),
    ).toBeVisible();
    await expect(counter).toHaveCount(0);

    await page.getByRole("link", { name: "Atendimento", exact: true }).click();
    await startAtReception(page);
    await page.getByRole("button", { name: "Chamar próximo" }).click();
    await expect(page.locator(".current-code")).toHaveText(code);
  } finally {
    await desk.close();
  }
});
