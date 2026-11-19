import { prisma } from "../apps/api/src/db";
import { expect, test } from "./fixture";

test("shows notices, tips, headlines and weather according to panel weights", async ({
  page,
  unit,
}) => {
  const city = `Cidade ${unit.slug}`;
  const category = unit.slug.slice(0, 45);
  const feed = await prisma.feedSource.create({
    data: { url: `https://example.invalid/${unit.slug}`, category },
  });
  try {
    await prisma.newsItem.create({
      data: {
        sourceId: feed.id,
        externalId: "first",
        source: "Jornal de teste",
        title: "Notícia do dia",
        category,
        publishedAt: new Date(),
      },
    });
    await prisma.weatherCache.create({
      data: {
        city,
        payload: {
          temperature: 24,
          description: "Ensolarado",
          days: [{ day: "2026-11-19", min: 15, max: 26 }],
          source: "Fonte simulada",
        },
      },
    });
    for (const [type, title] of [
      ["NOTICE", "Aviso da unidade"],
      ["TIP", "Dica da unidade"],
    ]) {
      const response = await unit.request.post("/api/admin/cards", {
        data: { type, title, text: "Conteúdo de teste", active: true },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
    }
    const registration = await unit.request.post("/api/admin/devices", {
      data: { name: "TV com conteúdo", type: "PANEL" },
    });
    expect(registration.ok()).toBeTruthy();
    const { device, code } = await registration.json();
    const setWeight = async (enabled: string) => {
      const weights = Object.fromEntries(
        ["NOTICE", "NEWS", "WEATHER", "TIP"].map((type) => [
          type,
          enabled === type ? 100 : 0,
        ]),
      );
      const result = await unit.request.put(`/api/admin/panels/${device.id}`, {
        data: {
          serviceIds: [],
          weights,
          cardSeconds: 5,
          city,
          newsCategories: [category],
          callDisplaySeconds: 5,
          ticker: "Atendimento por ordem de chamada",
        },
      });
      expect(result.ok(), await result.text()).toBeTruthy();
    };
    await setWeight("NOTICE");
    await page.goto(`/painel/${device.id}`);
    await page.getByLabel("Código de pareamento").fill(code);
    await page.getByRole("button", { name: "Parear dispositivo" }).click();
    await page.getByRole("button", { name: "Toque para iniciar" }).click();
    await expect(
      page.getByRole("heading", { name: "Aviso da unidade" }),
    ).toBeVisible();
    for (const [type, title] of [
      ["TIP", "Dica da unidade"],
      ["NEWS", "Notícia do dia"],
      ["WEATHER", city],
    ] as const) {
      await setWeight(type);
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
    await expect(
      page.getByText("Atendimento por ordem de chamada"),
    ).toBeVisible();
  } finally {
    await prisma.feedSource.delete({ where: { id: feed.id } });
    await prisma.weatherCache.deleteMany({ where: { city } });
  }
});
