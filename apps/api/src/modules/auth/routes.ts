import type { FastifyInstance } from "fastify";
import {
  loginInput,
  personalThemeInput,
  profileInput,
  readTheme,
  slugSchema,
} from "@beend/shared";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma, tenantDb } from "../../db.js";
import {
  authenticate,
  cookieOptions,
  requireActor,
  sessionCookie,
  sessionValue,
  updateProfile,
} from "./service.js";

export function authRoutes(app: FastifyInstance, secure: boolean) {
  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = loginInput.parse(request.body);
      const actor = await authenticate(
        input.tenant,
        input.email,
        input.password,
      );
      return reply
        .setCookie(sessionCookie, sessionValue(actor), {
          ...cookieOptions,
          secure,
        })
        .send(actor);
    },
  );
  app.get("/auth/session", (request) => requireActor(request, undefined, true));
  app.get(
    "/auth/branding/:slug",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { slug } = z.object({ slug: slugSchema }).parse(request.params);
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: { theme: true },
      });
      return reply
        .header("Cache-Control", "no-store")
        .send(readTheme(tenant?.theme));
    },
  );
  app.put(
    "/auth/profile",
    { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const actor = await requireActor(request, undefined, true);
      const updated = await updateProfile(
        actor,
        profileInput.parse(request.body),
      );
      return reply
        .setCookie(sessionCookie, sessionValue(updated), {
          ...cookieOptions,
          secure,
        })
        .send(updated);
    },
  );
  app.put("/auth/profile/theme", async (request) => {
    const actor = await requireActor(request);
    const { theme } = personalThemeInput.parse(request.body);
    await tenantDb(actor.tenantId).user.update({
      where: { id: actor.id, active: true },
      data: { personalTheme: theme ?? Prisma.DbNull },
    });
    return { theme };
  });
  app.post("/auth/logout", async (_request, reply) => {
    return reply
      .clearCookie(sessionCookie, { path: "/", secure })
      .code(204)
      .send();
  });
}
