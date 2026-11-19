import { expect, test } from "./fixture";

test("pairs the kiosk and prints a QR receipt after two selections", async ({
  page,
  unit,
}) => {
  const result = await unit.request.post("/api/admin/devices", {
    data: { name: "Totem de teste", type: "KIOSK" },
  });
  expect(result.ok(), await result.text()).toBeTruthy();
  const { device, code } = await result.json();
  await page.addInitScript(() => {
    window.print = () => {
      document.body.dataset.printed = "yes";
    };
  });
  await page.goto(`/totem/${device.id}`);
  await page.getByLabel("Código de pareamento").fill(code);
  await page.getByRole("button", { name: "Parear dispositivo" }).click();
  await page.getByRole("button", { name: "Recepção" }).click();
  await page.getByRole("button", { name: "Prioridade 80+" }).click();
  await expect(
    page.getByRole("heading", { name: "Senha emitida" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "RS001" })).toBeVisible();
  await expect(
    page.getByAltText("QR Code de acompanhamento da senha"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Acompanhar no celular" }),
  ).toHaveAttribute("href", /\/t\/[\w-]{32}$/);
  await expect(page.locator("body")).toHaveAttribute("data-printed", "yes");
  await page.getByRole("button", { name: "Concluir" }).click();
  await expect(
    page.getByRole("heading", { name: "Retire sua senha" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Recepção" })).toBeEnabled();
});
