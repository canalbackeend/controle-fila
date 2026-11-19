import type { FastifyInstance } from "fastify";
import { reportInput } from "@beend/shared";
import { requireActor } from "../auth/service.js";
import { report, reportCsv, reportOptions } from "./service.js";

export function reportsRoutes(app: FastifyInstance) {
  app.get("/reports/options", async (request) =>
    reportOptions(await requireActor(request, ["ADMIN", "SUPERADMIN"])),
  );
  app.get("/reports", async (request) =>
    report(
      await requireActor(request, ["ADMIN", "SUPERADMIN"]),
      reportInput.parse(request.query),
    ),
  );
  app.get("/reports.csv", async (request, reply) => {
    const actor = await requireActor(request, ["ADMIN", "SUPERADMIN"]);
    const input = reportInput.parse(request.query);
    const result = await report(actor, input);
    return reply
      .type("text/csv; charset=utf-8")
      .header(
        "Content-Disposition",
        `attachment; filename="beend-fila-${input.from}-${input.to}.csv"`,
      )
      .header("Cache-Control", "private, no-store")
      .send(reportCsv(result));
  });
}
