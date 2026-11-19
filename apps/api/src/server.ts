import { LogController } from "fastify";
import { z } from "zod";
import { prisma } from "./db.js";
import { contentJobs } from "./modules/content/jobs.js";
import { queueJobs } from "./modules/queue/jobs.js";
import { buildApp } from "./app.js";

const port = z.coerce
  .number()
  .int()
  .min(1)
  .max(65535)
  .default(3000)
  .parse(process.env.API_PORT);
const settings = z
  .object({
    SESSION_SECRET: z.string().min(32),
    APP_ORIGIN: z.url(),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  })
  .parse(process.env);
const app = buildApp(
  {
    logger: true,
    trustProxy: settings.TRUST_PROXY_HOPS
      ? (_address, hop) => hop < settings.TRUST_PROXY_HOPS
      : false,
    logController: new LogController({ disableRequestLogging: true }),
  },
  {
    secret: settings.SESSION_SECRET,
    origin: new URL(settings.APP_ORIGIN).origin,
    secure: settings.APP_ORIGIN.startsWith("https:"),
  },
);
const jobs = queueJobs(app);
const stopContent = contentJobs(app);
app.addHook("onClose", async () => {
  await jobs.destroy();
  await stopContent();
  await prisma.$disconnect();
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => void app.close());
}

await app.listen({ host: "0.0.0.0", port });
