import { expect, test } from "./fixture";

test("opens the QR destination on mobile and updates the ticket without signing in", async ({
  page,
  browser,
  unit,
}) => {
  const registration = await unit.request.post("/api/admin/devices", {
    data: { name: "Totem com QR", type: "KIOSK" },
  });
  expect(registration.ok(), await registration.text()).toBeTruthy();
  const { device, code } = await registration.json();
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await page.goto(`/totem/${device.id}`);
  await page.getByLabel("Código de pareamento").fill(code);
  await page.getByRole("button", { name: "Parear dispositivo" }).click();
  await page.getByRole("button", { name: "Recepção" }).click();
  await page.getByRole("button", { name: "Normal" }).click();
  const link = page.getByRole("link", { name: "Acompanhar no celular" });
  await expect(link).toBeVisible();

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    await mobile.addInitScript(() => {
      class TestNotification {
        static permission = "granted";
        constructor(title: string) {
          document.body.dataset.notification = title;
        }
      }
      Object.defineProperty(window, "Notification", {
        value: TestNotification,
      });
    });
    await mobile.goto((await link.getAttribute("href"))!);
    await expect(mobile.getByRole("heading", { name: "R001" })).toBeVisible();
    await expect(mobile.getByText("Aguardando chamada")).toBeVisible();
    await expect(mobile.getByLabel("Avisar quando restarem")).toHaveValue("3");
    await expect(mobile.getByText("pessoas à frente")).toBeVisible();
    const state = await (await unit.request.get("/api/attendant")).json();
    const serviceId = state.services[0].id;
    const counterId = state.counters[0].id;
    const shift = await unit.request.post("/api/attendant/shift", {
      data: { counterId, serviceIds: [serviceId] },
    });
    expect(shift.ok(), await shift.text()).toBeTruthy();
    const call = await unit.request.post("/api/queue/call", { data: {} });
    expect(call.ok(), await call.text()).toBeTruthy();
    await expect(mobile.getByText("Chamado", { exact: true })).toBeVisible({
      timeout: 3000,
    });
    await expect(mobile.getByText("Guichê 1")).toBeVisible();
    await expect(mobile.locator("body")).toHaveAttribute(
      "data-notification",
      "Senha R001 chamada",
    );
  } finally {
    await mobile.close();
  }
});
