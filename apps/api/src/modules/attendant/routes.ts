import type { FastifyInstance } from "fastify";
import { shiftInput } from "@beend/shared";
import { requireActor } from "../auth/service.js";
import { attendantState, endShift, startShift } from "./service.js";

export function attendantRoutes(app: FastifyInstance) {
  app.get("/attendant", async (request) =>
    attendantState(await requireActor(request)),
  );
  app.post("/attendant/shift", async (request, reply) => {
    await startShift(
      await requireActor(request),
      shiftInput.parse(request.body),
    );
    return reply.code(204).send();
  });
  app.delete("/attendant/shift", async (request, reply) => {
    await endShift(await requireActor(request));
    return reply.code(204).send();
  });
}
