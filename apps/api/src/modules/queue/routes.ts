import type { FastifyInstance } from "fastify";
import {
  callInput,
  idParams,
  issueInput,
  ticketActionInput,
} from "@beend/shared";
import type { Realtime } from "../../realtime.js";
import { requireActor } from "../auth/service.js";
import {
  callTicket,
  issueTicket,
  queueStats,
  ticketSummary,
  updateTicket,
} from "./service.js";

export function queueRoutes(
  app: FastifyInstance,
  publish: Realtime["publish"],
) {
  app.get("/queue/stats", async (request) =>
    queueStats(await requireActor(request)),
  );
  app.post("/queue/tickets", async (request, reply) => {
    const actor = await requireActor(request);
    const { receipt, change } = await issueTicket(
      actor,
      issueInput.parse(request.body),
      actor.id,
    );
    if (change) publish(actor, change);
    return reply.code(201).send(receipt);
  });
  app.post("/queue/call", async (request) => {
    const actor = await requireActor(request);
    const { code } = callInput.parse(request.body ?? {});
    const result = await callTicket(actor, code);
    publish(actor, result);
    return ticketSummary(result.ticket, result.displayName);
  });
  app.post("/queue/tickets/:id/action", async (request) => {
    const actor = await requireActor(request);
    const { id } = idParams.parse(request.params);
    const result = await updateTicket(
      actor,
      id,
      ticketActionInput.parse(request.body),
    );
    publish(actor, result);
    return ticketSummary(result.ticket, result.displayName);
  });
}
