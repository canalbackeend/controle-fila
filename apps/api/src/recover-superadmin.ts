import { prisma } from "./db.js";
import { recoverSuperadmin } from "./modules/platform/recovery.js";

// Usage: pnpm --filter api recover-superadmin [novo-email]
const email = process.argv[2];
try {
  const {
    slug,
    email: account,
    password,
  } = await recoverSuperadmin({
    email,
  });
  process.stdout.write(
    [
      "",
      "Conta superadmin recuperada.",
      `  Identificador da empresa: ${slug}`,
      `  E-mail: ${account}`,
      `  Senha provisória: ${password}`,
      "",
      "Entre no sistema e troque a senha em Meu perfil. Sessões antigas foram encerradas.",
      "",
    ].join("\n"),
  );
} catch (error) {
  process.stderr.write(
    `Não foi possível recuperar a conta: ${error instanceof Error ? error.message : "erro desconhecido"}\n`,
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
