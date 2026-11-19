import { schedule } from "node-cron";
import type { FastifyInstance } from "fastify";
import { prisma, tenantDb } from "../../db.js";
import { expireQueue } from "./service.js";

export function queueJobs(app: FastifyInstance) {
  return schedule(
    "* * * * *",
    async () => {
      try {
        const now = new Date();
        const tenants = await prisma.tenant.findMany({
          select: {
            id: true,
            resetTime: true,
            timeZone: true,
            retentionDays: true,
          },
        });
        for (const tenant of tenants) {
          try {
            const db = tenantDb(tenant.id);
            const units = await db.unit.findMany({ select: { id: true } });
            for (const unit of units)
              await expireQueue(
                {
                  tenantId: tenant.id,
                  unitId: unit.id,
                  resetTime: tenant.resetTime,
                  timeZone: tenant.timeZone,
                },
                now,
              );
            const cutoff = new Date(
              now.getTime() - tenant.retentionDays * 86_400_000,
            );
            await db.ticket.updateMany({
              where: { issuedAt: { lt: cutoff }, customerName: { not: null } },
              data: { customerName: null },
            });
          } catch {
            app.log.error({ tenantId: tenant.id }, "Queue maintenance failed");
          }
        }
      } catch {
        app.log.error("Could not start queue maintenance");
      }
    },
    { noOverlap: true },
  );
}
