import { expect, test } from "./fixture";

test("an attendant can open both unit devices from their profile", async ({
  page,
  unit,
}) => {
  const devices = await Promise.all(
    [
      { name: "Terminal de teste", type: "KIOSK", route: "totem" },
      { name: "TV de teste", type: "PANEL", route: "painel" },
    ].map(async ({ route, ...data }) => {
      const response = await unit.request.post("/api/admin/devices", { data });
      expect(response.ok(), await response.text()).toBeTruthy();
      const { device } = await response.json();
      return { route, device };
    }),
  );
  await unit.login(page, "staff@test.local");
  await page.getByRole("link", { name: "Perfil", exact: true }).click();
  for (const { route, device } of devices) {
    const link = page.getByRole("link", { name: device.name, exact: true });
    await expect(link).toHaveAttribute("href", `/${route}/${device.id}`);
    const popup = page.waitForEvent("popup");
    await link.click();
    const screen = await popup;
    await expect(
      screen.getByRole("heading", {
        name: route === "totem" ? "Parear totem" : "Parear painel de TV",
      }),
    ).toBeVisible();
    await screen.close();
  }
});
