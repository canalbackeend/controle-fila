import type { FastifyInstance } from "fastify";
import {
  callInput,
  idParams,
  issueInput,
  ticketActionInput,
} from "@beend/shared";
import { requireActor } from "../auth/service.js";
import {
  callTicket,
  issueTicket,
  queueStats,
  ticketSummary,
  updateTicket,
} from "./service.js";

export function queueRoutes(app: FastifyInstance) {
  app.get("/queue/stats", async (request) =>
    queueStats(await requireActor(request)),
  );
  app.post("/queue/tickets", async (request, reply) => {
    const actor = await requireActor(request);
    const { receipt } = await issueTicket(
      actor,
      issueInput.parse(request.body),
      actor.id,
    );
    return reply.code(201).send(receipt);
  });
  app.post("/queue/call", async (request) => {
    const actor = await requireActor(request);
    const { code } = callInput.parse(request.body ?? {});
    const result = await callTicket(actor, code);
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
    return ticketSummary(result.ticket, result.displayName);
  });
}
