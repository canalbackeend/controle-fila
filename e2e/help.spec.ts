import { expect, test } from "./fixture";

test("opens the privacy policy and terms without signing in", async ({
  page,
}) => {
  await page.goto("/entrar");
  await page.getByRole("link", { name: "Política de Privacidade" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Política de Privacidade" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "10. Seus direitos" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Documentos" })
    .getByRole("link", { name: "Termos de Uso" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Termos de Uso" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/termos$/);
});

test("administrators browse and search the help center", async ({
  page,
  unit,
}) => {
  await unit.login(page);
  await page.getByRole("link", { name: "Ajuda", exact: true }).click();
  const article = page.getByRole("article");
  await expect(
    article.getByRole("heading", { name: "Primeiros passos" }),
  ).toBeVisible();
  await page.getByLabel("Buscar na ajuda").fill("impressora");
  const index = page.getByRole("navigation", { name: "Artigos da ajuda" });
  await index.getByRole("link", { name: "Totem de autoatendimento" }).click();
  await expect(page).toHaveURL(/\/ajuda\/totem$/);
  await expect(
    article.getByRole("heading", { name: "Impressão" }),
  ).toBeVisible();
  await page.getByLabel("Buscar na ajuda").fill("palavra que nao existe");
  await expect(page.getByText("Nenhum artigo encontrado.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fale com o suporte" }),
  ).toBeVisible();
});

test("attendants see only the guides for their work", async ({
  page,
  unit,
}) => {
  await unit.login(page, "staff@test.local");
  await page.getByRole("link", { name: "Ajuda", exact: true }).click();
  const index = page.getByRole("navigation", { name: "Artigos da ajuda" });
  await expect(
    index.getByRole("link", { name: "Atender a fila" }),
  ).toBeVisible();
  await expect(
    index.getByRole("link", { name: "Totem de autoatendimento" }),
  ).toHaveCount(0);
  await expect(
    index.getByRole("link", { name: "Gestão de clientes (Beend)" }),
  ).toHaveCount(0);
  await page.goto("/ajuda/plataforma");
  await expect(
    page.getByRole("article").getByRole("heading", { name: "Atender a fila" }),
  ).toBeVisible();
  await expect(
    page.getByText("procure o administrador da sua empresa"),
  ).toBeVisible();
});
