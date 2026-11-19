import { LogController } from "fastify";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { buildApp } from "./app.js";

config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});
const port = z.coerce
  .number()
  .int()
  .min(1)
  .max(65535)
  .default(3000)
  .parse(process.env.API_PORT);
const app = buildApp({
  logger: true,
  logController: new LogController({ disableRequestLogging: true }),
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => void app.close());
}

await app.listen({ host: "0.0.0.0", port });
