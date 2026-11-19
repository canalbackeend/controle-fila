import type { FastifyInstance } from "fastify";
import { shiftInput } from "@beend/shared";
import { requireActor } from "../auth/service.js";
import type { Realtime } from "../../realtime.js";
import { attendantState, endShift, startShift } from "./service.js";

export function attendantRoutes(app: FastifyInstance, realtime: Realtime) {
  app.get("/attendant", async (request) =>
    attendantState(await requireActor(request)),
  );
  app.post("/attendant/shift", async (request, reply) => {
    const actor = await requireActor(request);
    await startShift(actor, shiftInput.parse(request.body));
    realtime.publishShift(actor);
    return reply.code(204).send();
  });
  app.delete("/attendant/shift", async (request, reply) => {
    const actor = await requireActor(request);
    if (await endShift(actor)) realtime.publishShift(actor);
    return reply.code(204).send();
  });
}
