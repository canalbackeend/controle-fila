import { expect, test } from "./fixture";

test("queues calls on the paired TV and restores the display", async ({
  page,
  unit,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const registration = await unit.request.post("/api/admin/devices", {
    data: { name: "TV de teste", type: "PANEL" },
  });
  expect(registration.ok(), await registration.text()).toBeTruthy();
  const { device, code } = await registration.json();
  const configured = await unit.request.put(`/api/admin/panels/${device.id}`, {
    data: {
      serviceIds: [],
      weights: { NOTICE: 0, NEWS: 0, WEATHER: 0, TIP: 0 },
      cardSeconds: 10,
      newsCategories: [],
      city: "São Paulo",
      callDisplaySeconds: 5,
      ticker: "",
    },
  });
  expect(configured.ok(), await configured.text()).toBeTruthy();
  await page.goto(`/painel/${device.id}`);
  await page.getByLabel("Código de pareamento").fill(code);
  await page.getByRole("button", { name: "Parear dispositivo" }).click();
  await page.getByRole("button", { name: "Toque para iniciar" }).click();
  await expect(
    page.getByRole("heading", { name: "Aguarde sua chamada" }),
  ).toBeVisible();
  const state = await (await unit.request.get("/api/attendant")).json();
  const service = state.services[0];
  const counter = state.counters[0];
  const shift = await unit.request.post("/api/attendant/shift", {
    data: { counterId: counter.id, serviceIds: [service.id] },
  });
  expect(shift.ok(), await shift.text()).toBeTruthy();
  const receipt = await unit.request.post("/api/queue/tickets", {
    data: { serviceId: service.id, priority: "NORMAL" },
  });
  expect(receipt.ok(), await receipt.text()).toBeTruthy();
  const ticket = await receipt.json();
  const call = await unit.request.post("/api/queue/call", { data: {} });
  expect(call.ok(), await call.text()).toBeTruthy();
  const overlay = page.getByRole("region", { name: "Chamada em destaque" });
  await expect(overlay.getByText(ticket.code)).toBeVisible({ timeout: 1500 });
  await expect(overlay.getByText("Senha chamada")).toBeVisible();
  const recall = await unit.request.post(
    `/api/queue/tickets/${ticket.id}/action`,
    { data: { action: "RECALL" } },
  );
  expect(recall.ok(), await recall.text()).toBeTruthy();
  await expect(overlay.getByText("Rechamada")).toBeVisible({ timeout: 6500 });
  await expect(overlay).toHaveCount(0, { timeout: 6500 });
  await expect(
    page.getByRole("heading", { name: "Aguarde sua chamada" }),
  ).toBeVisible();
  const font = await page
    .locator(".tv-current .tv-call-code")
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
  expect(font).toBeGreaterThanOrEqual(160);
});
