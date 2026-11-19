import type { FastifyInstance } from "fastify";
import { loginInput } from "@beend/shared";
import {
  authenticate,
  cookieOptions,
  requireActor,
  sessionCookie,
  sessionValue,
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
  app.get("/auth/session", (request) => requireActor(request));
  app.post("/auth/logout", async (_request, reply) => {
    return reply
      .clearCookie(sessionCookie, { path: "/", secure })
      .code(204)
      .send();
  });
}
