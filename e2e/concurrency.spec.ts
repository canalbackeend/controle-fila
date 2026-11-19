import { expect, test } from "./fixture";

test("two attendants see the queue live and call different tickets", async ({
  page,
  browser,
  unit,
}) => {
  const other = await browser.newPage();
  try {
    await Promise.all([
      unit.login(page),
      unit.login(other, "staff@test.local"),
    ]);
    await page.getByRole("link", { name: "Atendimento" }).click();
    for (const [desk, label] of [
      [page, "Recepção"],
      [other, "Triagem"],
    ] as const) {
      await desk.getByRole("combobox", { name: "Guichê", exact: true }).selectOption({ label });
      await desk.getByRole("checkbox", { name: "Recepção" }).check();
      await desk.getByRole("button", { name: "Iniciar turno" }).click();
      await expect(
        desk.getByRole("heading", { name: "Filas do guichê" }),
      ).toBeVisible();
      await expect(desk.getByText("Conectado", { exact: true })).toBeVisible();
    }
    const { services } = await (await unit.request.get("/api/admin")).json();
    const serviceId = services.find(
      (service: { name: string }) => service.name === "Recepção",
    ).id;
    for (let index = 0; index < 2; index++) {
      const result = await unit.request.post("/api/queue/tickets", {
        data: { serviceId, priority: "NORMAL" },
      });
      expect(result.ok(), await result.text()).toBeTruthy();
    }
    await expect(page.getByText("2 aguardando")).toBeVisible();
    await expect(other.getByText("2 aguardando")).toBeVisible();
    await Promise.all(
      [page, other].map((desk) =>
        desk.getByRole("button", { name: "Chamar próximo" }).click(),
      ),
    );
    await expect(
      page.getByRole("button", { name: "Iniciar atendimento" }),
    ).toBeVisible();
    await expect(
      other.getByRole("button", { name: "Iniciar atendimento" }),
    ).toBeVisible();
    const codes = await Promise.all([
      page.locator(".current-code").textContent(),
      other.locator(".current-code").textContent(),
    ]);
    expect(codes.sort()).toEqual(["R001", "R002"]);
  } finally {
    await other.close();
  }
});
