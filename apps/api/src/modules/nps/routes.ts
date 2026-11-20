import type { FastifyInstance } from "fastify";
import {
  npsInput,
  npsIntervalDays,
  npsPeriodInput,
  npsSummary,
  type Actor,
  type NpsReport,
  type NpsStatus,
} from "@beend/shared";
import { prisma, tenantDb, tenantTransaction } from "../../db.js";
import { HttpError } from "../../errors.js";
import { requireActor } from "../auth/service.js";

const intervalMs = npsIntervalDays * 86_400_000;

function respondent(actor: Actor) {
  if (actor.role === "SUPERADMIN")
    throw new HttpError(403, "A pesquisa é respondida pelos clientes.");
  return actor as Actor & { role: "ADMIN" | "ATTENDANT" };
}

export function npsRoutes(app: FastifyInstance) {
  app.get("/nps/status", async (request): Promise<NpsStatus> => {
    const actor = await requireActor(request);
    if (actor.role === "SUPERADMIN") return { due: false };
    const recent = await tenantDb(actor.tenantId).npsResponse.findFirst({
      where: {
        userId: actor.id,
        createdAt: { gt: new Date(Date.now() - intervalMs) },
      },
      select: { id: true },
    });
    return { due: !recent };
  });

  app.post(
    "/nps",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const actor = respondent(await requireActor(request));
      const { score, comment } = npsInput.parse(request.body);
      await tenantTransaction(actor.tenantId, async (db) => {
        await db.$queryRaw`SELECT id FROM "User" WHERE id = ${actor.id} AND "tenantId" = ${actor.tenantId} FOR UPDATE`;
        const recent = await db.npsResponse.findFirst({
          where: {
            userId: actor.id,
            createdAt: { gt: new Date(Date.now() - intervalMs) },
          },
          select: { id: true },
        });
        if (recent)
          throw new HttpError(
            409,
            `Você já respondeu à pesquisa nos últimos ${npsIntervalDays} dias.`,
          );
        await db.npsResponse.create({
          data: {
            tenantId: actor.tenantId,
            userId: actor.id,
            role: actor.role,
            score,
            comment,
          },
        });
      });
      return reply.code(204).send();
    },
  );

  app.get("/admin/nps", async (request, reply): Promise<NpsReport> => {
    await requireActor(request, ["SUPERADMIN"]);
    const { days } = npsPeriodInput.parse(request.query);
    const since = new Date(Date.now() - days * 86_400_000);
    const where = { createdAt: { gte: since } };
    const [scores, responses] = await Promise.all([
      prisma.npsResponse.findMany({ where, select: { score: true } }),
      prisma.npsResponse.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 300,
        select: {
          id: true,
          role: true,
          score: true,
          comment: true,
          createdAt: true,
          tenant: { select: { name: true } },
        },
      }),
    ]);
    reply.header("Cache-Control", "private, no-store");
    return {
      days,
      ...npsSummary(scores.map(({ score }) => score)),
      responses: responses.map(({ tenant, role, createdAt, ...item }) => ({
        ...item,
        role: role === "ATTENDANT" ? "ATTENDANT" : "ADMIN",
        companyName: tenant.name,
        createdAt: createdAt.toISOString(),
      })),
    };
  });
}
