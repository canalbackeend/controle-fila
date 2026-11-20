import { readFile } from "node:fs/promises";
import { prisma } from "../apps/api/src/db";
import { weatherCacheKey } from "../apps/api/src/modules/content/weather";
import { expect, test } from "./fixture";

test("shows notices, tips, headlines and weather according to panel weights", async ({
  browser,
  page,
  unit,
}) => {
  test.setTimeout(60000);
  const city = `Cidade ${unit.slug}`;
  const states = ["SP", "MG"] as const;
  const cacheKeys = states.map((state) => weatherCacheKey({ city, state }));
  const category = unit.slug.slice(0, 45);
  const feed = await prisma.feedSource.create({
    data: { url: `https://example.invalid/${unit.slug}`, category },
  });
  try {
    const upload = await unit.request.post("/api/admin/assets", {
      multipart: {
        file: {
          name: "foto.png",
          mimeType: "image/png",
          buffer: await readFile(
            new URL(
              "../apps/web/src/assets/beend-tech-transparente.png",
              import.meta.url,
            ),
          ),
        },
      },
    });
    expect(upload.ok()).toBeTruthy();
    const { imageUrl } = await upload.json();
    await prisma.newsIllustration.create({
      data: {
        category,
        fileTitle: "File:Imagem de teste.jpg",
        imageUrl,
        author: "Autor de teste",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Imagem_de_teste.jpg",
      },
    });
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
    await prisma.weatherCache.createMany({
      data: cacheKeys.map((key, index) => ({
        city: key,
        payload: {
          temperature: index === 0 ? 24 : 31,
          description: "Ensolarado",
          days: [{ day: "2026-11-19", min: 15, max: 26 }],
          source: "Fonte simulada",
        },
      })),
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
          state: "SP",
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
    ] as const) {
      await setWeight(type);
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
    const photo = page.locator(".tv-news.with-image img");
    await expect(photo).toHaveAttribute("src", imageUrl);
    await expect(photo).toHaveCSS("object-fit", "cover");
    await expect
      .poll(() =>
        photo.evaluate((element) =>
          element instanceof HTMLImageElement ? element.naturalWidth : 0,
        ),
      )
      .toBeGreaterThan(0);
    await expect(page.getByText("Foto ilustrativa recortada")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Autor de teste" }),
    ).toBeVisible();
    const admin = await browser.newPage({
      baseURL: new URL(page.url()).origin,
    });
    try {
      await unit.login(admin);
      await admin
        .getByRole("link", { name: "Dispositivos", exact: true })
        .click();
      await admin.getByRole("link", { name: "Configurar TV e clima" }).click();
      const weather = admin.getByRole("group", { name: "Previsão do tempo" });
      await weather.getByLabel("Cidade", { exact: true }).fill(city);
      await weather
        .getByRole("combobox", { name: /^Estado/ })
        .selectOption("MG");
      await weather.getByLabel("Peso do clima").fill("100");
      await admin.getByLabel("Notícias", { exact: true }).fill("0");
      await admin.getByRole("button", { name: "Salvar painel" }).click();
      await expect(admin.getByText("Configuração salva.")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: `${city}, MG` }),
      ).toBeVisible();
      await expect(page.locator(".tv-temperature")).toContainText("31°C");
      await expect(page.locator(".tv-temperature")).toContainText(
        "Fonte simulada",
      );

      const news = admin.getByRole("group", { name: "Notícias da TV" });
      const health = news.getByRole("button", { name: "Saúde e bem-estar" });
      await health.click();
      await expect(health).toHaveAttribute("aria-pressed", "true");
      await expect(news.getByRole("status")).toHaveText(
        "Perfil de notícias aplicado.",
      );
      await expect(admin.getByLabel("Notícias", { exact: true })).toHaveValue(
        "30",
      );
      await expect(
        weather.getByRole("combobox", { name: /^Estado/ }),
      ).toHaveValue("MG");
      await news.getByText("Configuração manual", { exact: true }).click();
      await news.getByLabel("Saúde e bem-estar", { exact: true }).uncheck();
      await news.getByLabel("Cidadania e serviços", { exact: true }).uncheck();
      await news.getByRole("button", { name: "Salvar notícias" }).click();
      await expect(news.getByRole("status")).toHaveText(
        "Preferências de notícias salvas.",
      );
      await admin.getByRole("button", { name: "Salvar painel" }).click();
      await expect(admin.getByText("Configuração salva.")).toBeVisible();
      const config = await unit.request.get(`/api/admin/panels/${device.id}`);
      expect((await config.json()).config).toMatchObject({
        newsMode: "CUSTOM",
        newsCategories: [],
        state: "MG",
      });
      await news
        .getByRole("link", { name: "Cadastrar notícia própria" })
        .click();
      await admin.getByRole("button", { name: "Adicionar conteúdo" }).click();
      await admin.getByRole("combobox", { name: /^Tipo/ }).selectOption("NEWS");
      await admin
        .getByLabel("Título", { exact: true })
        .fill("Notícia própria da unidade");
      await admin.getByRole("button", { name: "Salvar conteúdo" }).click();
      await expect(admin.getByText("Conteúdo salvo.")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Notícia própria da unidade" }),
      ).toBeVisible({ timeout: 40000 });
    } finally {
      await admin.close();
    }
    await expect(
      page.getByText("Atendimento por ordem de chamada").first(),
    ).toBeVisible();
  } finally {
    await prisma.feedSource.delete({ where: { id: feed.id } });
    await prisma.newsIllustration.deleteMany({ where: { category } });
    await prisma.weatherCache.deleteMany({
      where: { city: { in: cacheKeys } },
    });
  }
});
