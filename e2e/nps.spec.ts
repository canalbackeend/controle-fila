import { randomUUID } from "node:crypto";
import { expect, test } from "./fixture";
import { prisma } from "../apps/api/src/db";
import { createTenant } from "../apps/api/src/modules/admin/service";

test("client staff rate beend.tech and only the Beend operator sees the results", async ({
  page,
  unit,
  browser,
}) => {
  const comment = `Fila muito rápida ${randomUUID().slice(0, 6)}`;
  await unit.login(page);
  await expect(
    page.getByText("© beend.tech 2026 - Todos os direitos reservados"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "suporte@beend.tech" }),
  ).toHaveAttribute("href", "mailto:suporte@beend.tech");

  await page
    .getByRole("button", { name: "Abrir pesquisa de satisfação" })
    .click();
  const survey = page.getByRole("dialog", {
    name: /você recomendaria a beend.tech/,
  });
  const send = survey.getByRole("button", { name: "Enviar feedback" });
  await expect(send).toBeDisabled();
  await survey.getByRole("button", { name: "9", exact: true }).click();
  await expect(
    survey.getByRole("button", { name: "9", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await survey
    .getByLabel("Conte o motivo da sua nota (opcional)")
    .fill(comment);
  await send.click();
  await expect(page.getByText("Obrigado pelo seu feedback!")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Abrir pesquisa de satisfação" }),
  ).toHaveCount(0);
  await page.goto("/plataforma/satisfacao");
  await expect(page).not.toHaveURL(/satisfacao/);

  const slug = `nps-operator-${randomUUID()}`;
  const operator = await createTenant(
    {
      slug,
      name: "Beend",
      unitName: "Beend",
      adminName: "Operação Beend",
      email: "operator@beend.local",
      password: "operator password 2026",
    },
    "SUPERADMIN",
  );
  const context = await browser.newContext();
  try {
    const beend = await context.newPage();
    await beend.goto(`/entrar?empresa=${slug}`);
    await beend.getByLabel("E-mail").fill("operator@beend.local");
    await beend.getByLabel("Senha").fill("operator password 2026");
    await beend.getByRole("button", { name: "Entrar" }).click();
    await beend.getByRole("link", { name: "Satisfação" }).click();
    await expect(
      beend.getByRole("heading", { name: "Satisfação dos clientes" }),
    ).toBeVisible();
    const row = beend.getByRole("row", { name: new RegExp(comment) });
    await expect(row).toContainText("Administrador");
    await expect(row).toContainText("9");
    await expect(
      beend.getByRole("button", { name: "Abrir pesquisa de satisfação" }),
    ).toHaveCount(0);
  } finally {
    await context.close();
    await prisma.tenant.delete({ where: { id: operator.id } });
  }
});
