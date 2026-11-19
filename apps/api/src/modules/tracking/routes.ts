import type { FastifyInstance } from "fastify";
import { trackingParams } from "@beend/shared";
import { trackingData } from "./service.js";

export function trackingRoutes(app: FastifyInstance) {
  app.get("/track/:token", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const { token } = trackingParams.parse(request.params);
    return trackingData(token);
  });
}
