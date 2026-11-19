import { z } from "zod";
import { passwordSchema } from "@beend/shared";
import { prisma } from "./db.js";
import { createTenant } from "./modules/admin/service.js";
import { templates } from "./modules/admin/templates.js";

const env = z
  .object({
    DEMO_ADMIN_PASSWORD: z.preprocess(
      (value) => value || undefined,
      passwordSchema.optional(),
    ),
    SUPERADMIN_PASSWORD: passwordSchema,
  })
  .parse(process.env);
try {
  if (!(await prisma.tenant.findUnique({ where: { slug: "beend" } }))) {
    await createTenant(
      {
        slug: "beend",
        name: "Beend",
        unitName: "Beend",
        adminName: "Equipe Beend",
        email: "superadmin@beend.local",
        password: env.SUPERADMIN_PASSWORD,
      },
      "SUPERADMIN",
    );
  }
  if (
    env.DEMO_ADMIN_PASSWORD &&
    !(await prisma.tenant.findUnique({ where: { slug: "demo" } }))
  ) {
    await createTenant({
      slug: "demo",
      name: "Unidade Demo",
      unitName: "Unidade principal",
      adminName: "Administrador",
      email: "admin@demo.local",
      password: env.DEMO_ADMIN_PASSWORD,
    });
  }
  for (const { id, ...data } of templates) {
    await prisma.template.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }
  process.stdout.write("Cadastros iniciais preparados.\n");
} finally {
  await prisma.$disconnect();
}
