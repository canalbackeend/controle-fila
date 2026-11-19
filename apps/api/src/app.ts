import Fastify, { type FastifyServerOptions } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { HttpError } from "./errors.js";
import { authRoutes } from "./modules/auth/routes.js";
import { attendantRoutes } from "./modules/attendant/routes.js";
import { deviceRoutes } from "./modules/devices/routes.js";
import { attachRealtime } from "./realtime.js";
import { queueRoutes } from "./modules/queue/routes.js";
import { adminRoutes } from "./modules/admin/routes.js";

export function buildApp(
  options: FastifyServerOptions = {},
  settings?: { secret: string; origin: string; secure: boolean },
) {
  const app = Fastify(options);
  app.get("/health", async () => ({ status: "ok" }));
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      const fields = error.issues
        .map((issue) => issue.path.join("."))
        .filter(Boolean);
      return reply.code(400).send({
        message: fields.length
          ? `Verifique os campos: ${[...new Set(fields)].join(", ")}.`
          : "Dados inválidos.",
      });
    }
    if (error instanceof HttpError)
      return reply.code(error.statusCode).send({ message: error.message });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025")
        return reply.code(404).send({ message: "Registro não encontrado." });
      if (error.code === "P2002")
        return reply
          .code(409)
          .send({ message: "Já existe um registro com esses dados." });
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.code(status).send({
        message:
          status === 429
            ? "Muitas tentativas. Aguarde e tente novamente."
            : "Não foi possível processar a solicitação.",
      });
    }
    app.log.error(
      { type: error instanceof Error ? error.name : "UnknownError" },
      "Request failed",
    );
    return reply
      .code(500)
      .send({ message: "Falha ao processar a solicitação." });
  });

  if (settings) {
    app.register(async (api) => {
      await api.register(cookie, { secret: settings.secret });
      await api.register(rateLimit, { global: false });
      api.addHook("onRequest", async (request) => {
        if (
          !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
          request.headers.origin &&
          request.headers.origin !== settings.origin
        ) {
          throw new HttpError(403, "Origem da solicitação inválida.");
        }
      });
      authRoutes(api, settings.secure);
      adminRoutes(api);
      attendantRoutes(api);
      const realtime = attachRealtime(api, settings.origin);
      queueRoutes(api, realtime.publish);
      deviceRoutes(api, realtime);
    });
  }
  return app;
}
