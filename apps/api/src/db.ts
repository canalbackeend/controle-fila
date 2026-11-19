import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";

config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

export const prisma = new PrismaClient();

export function tenantDb(tenantId: string) {
  const extension = Prisma.defineExtension({
    query: {
      $allModels: {
        $allOperations({ operation, args, query, model }) {
          if (
            model === "Template" ||
            model === "FeedSource" ||
            model === "NewsItem" ||
            model === "WeatherCache"
          ) {
            throw new Error("Global model accessed from tenant repository");
          }
          const input = args as Record<string, unknown>;
          const filter = model === "Tenant" ? { id: tenantId } : { tenantId };
          const assign = (value: unknown) => ({
            ...(value as object),
            ...filter,
          });
          switch (operation) {
            case "create":
              input.data = assign(input.data);
              break;
            case "createMany":
            case "createManyAndReturn":
              input.data = Array.isArray(input.data)
                ? input.data.map(assign)
                : assign(input.data);
              break;
            case "upsert":
              input.create = assign(input.create);
              input.where = assign(input.where);
              break;
            default:
              input.where = assign(input.where);
          }
          return query(args);
        },
      },
    },
  });
  return prisma.$extends(extension);
}

export type TenantTransaction = Omit<
  ReturnType<typeof tenantDb>,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export function tenantTransaction<T>(
  tenantId: string,
  operation: (db: TenantTransaction) => Promise<T>,
) {
  return tenantDb(tenantId).$transaction(operation, {
    maxWait: 15000,
    timeout: 20000,
  });
}
