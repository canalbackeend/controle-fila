import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { tenantDb, prisma } from "../apps/api/src/db";
import { createTenant } from "../apps/api/src/modules/admin/service";

test("the Beend operator provisions a client who activates and operates within its limits", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(60000);
  const operatorSlug = `operator-${randomUUID()}`;
  const customerSlug = `customer-${randomUUID()}`;
  const operatorEmail = "operator@test.local";
  const customerEmail = "client@test.local";
  const operatorPassword = "platform-e2e-strong-password";
  const customerPassword = "client-e2e-renewed-password";
  const operator = await createTenant(
    {
      slug: operatorSlug,
      name: "Operação Beend",
      unitName: "Beend",
      adminName: "Operador",
      email: operatorEmail,
      password: operatorPassword,
    },
    "SUPERADMIN",
  );
  const clientContext = await browser.newContext({ baseURL });

  try {
    await page.goto(`/entrar?empresa=${operatorSlug}`);
    await page.getByLabel("E-mail").fill(operatorEmail);
    await page.getByLabel("Senha", { exact: true }).fill(operatorPassword);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL("**/plataforma/empresas");
    await page.getByRole("button", { name: "Cadastrar empresa" }).click();
    await page.getByLabel("Nome da empresa").fill("Clínica de teste");
    await page.getByLabel("Identificador da empresa").fill(customerSlug);
    await page
      .getByLabel("Nome do administrador")
      .fill("Administrador da clínica");
    await page.getByLabel("E-mail do administrador").fill(customerEmail);
    await page.getByLabel("Limite de TVs").fill("0");
    await page.getByRole("button", { name: "Criar empresa" }).click();
    await expect(
      page.getByRole("heading", { name: "Acesso inicial" }),
    ).toBeVisible();
    const secret = await page.locator(".platform-access code").textContent();
    expect(secret).toHaveLength(32);
    const customer = await clientContext.newPage();
    await customer.goto(`/entrar?empresa=${customerSlug}`);
    await customer.getByLabel("E-mail").fill(customerEmail);
    await customer.getByLabel("Senha", { exact: true }).fill(secret!);
    await customer.getByRole("button", { name: "Entrar", exact: true }).click();
    await customer.waitForURL("**/perfil");
    await expect(
      customer.getByText(
        "Troque a senha inicial para liberar o acesso à sua empresa.",
      ),
    ).toBeVisible();
    await customer.getByLabel("Senha atual", { exact: true }).fill(secret!);
    await customer
      .getByLabel("Nova senha", { exact: true })
      .fill(customerPassword);
    await customer
      .getByLabel("Confirme a nova senha", { exact: true })
      .fill(customerPassword);
    await customer.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(customer.getByText("Perfil salvo.")).toBeVisible();
    await expect(
      customer.getByRole("link", { name: "Empresas", exact: true }),
    ).toHaveCount(0);
    await customer
      .getByRole("link", { name: "Administração", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Clínica", exact: true })
      .click();
    await expect(customer.getByText("Modelo aplicado.")).toBeVisible();
    await customer
      .getByRole("link", { name: "Dispositivos", exact: true })
      .click();
    await customer
      .getByRole("combobox", { name: "Tipo" })
      .selectOption("PANEL");
    await expect(
      customer.getByRole("button", { name: "Gerar código de pareamento" }),
    ).toBeDisabled();
    await customer
      .getByRole("combobox", { name: "Tipo" })
      .selectOption("KIOSK");
    await customer.getByLabel("Nome", { exact: true }).fill("Totem da unidade");
    await customer
      .getByRole("button", { name: "Gerar código de pareamento" })
      .click();
    await expect(
      customer.getByRole("heading", { name: "Parear Totem da unidade" }),
    ).toBeVisible();
    await expect(
      customer.getByText("Totens 1 de 1 · TVs 0 de 0"),
    ).toBeVisible();
    await expect(
      customer.getByRole("button", { name: "Gerar código de pareamento" }),
    ).toBeDisabled();
    const kioskPath = await customer
      .getByRole("link", { name: "Abrir totem", exact: true })
      .getAttribute("href");
    const code = await customer.locator(".pair-code").textContent();
    const kiosk = await clientContext.newPage();
    await kiosk.goto(kioskPath!);
    await kiosk.getByLabel("Código de pareamento").fill(code!);
    await kiosk.getByRole("button", { name: "Parear dispositivo" }).click();
    await expect(kiosk.getByRole("button", { name: "Recepção" })).toBeEnabled();
    await customer
      .getByRole("link", { name: "Relatórios", exact: true })
      .click();
    await expect(
      customer.getByRole("heading", { name: "Relatórios", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Fechar dados de acesso" }).click();
    const row = page.getByRole("listitem").filter({ hasText: customerSlug });
    page.once("dialog", (dialog) => void dialog.accept());
    await row.getByRole("button", { name: "Suspender", exact: true }).click();
    await expect(
      kiosk.getByRole("heading", { name: "Totem indisponível" }),
    ).toBeVisible();
    await customer.waitForURL("**/entrar");
    await row.getByRole("button", { name: "Reativar" }).click();
    await expect(kiosk.getByRole("button", { name: "Recepção" })).toBeEnabled({
      timeout: 18000,
    });
  } finally {
    await clientContext.close();
    const client = await prisma.tenant.findUnique({
      where: { slug: customerSlug },
    });
    if (client) {
      const db = tenantDb(client.id);
      await db.device.deleteMany({});
      await db.service.deleteMany({});
      await db.counter.deleteMany({});
      await db.tenant.delete({ where: { id: client.id } });
    }
    await tenantDb(operator.id).tenant.delete({ where: { id: operator.id } });
  }
});
