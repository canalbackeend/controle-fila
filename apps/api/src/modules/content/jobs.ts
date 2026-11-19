import { schedule } from "node-cron";
import type { FastifyInstance } from "fastify";
import { defaultPanelSettings } from "@beend/shared";
import { prisma, tenantDb } from "../../db.js";
import { configureSources, refreshNews } from "./news.js";
import { configuredWeatherProvider } from "./weather.js";

export function contentJobs(app: FastifyInstance) {
  const provider = configuredWeatherProvider();
  async function news() {
    try {
      await refreshNews((feedId) =>
        app.log.warn({ feedId }, "Feed refresh failed"),
      );
    } catch {
      app.log.error("News refresh failed");
    }
  }
  async function weather() {
    if (!provider) return;
    try {
      const tenants = await prisma.tenant.findMany({ select: { id: true } });
      const cities = new Set<string>([defaultPanelSettings.city]);
      for (const { id } of tenants) {
        const configs = await tenantDb(id).panelConfig.findMany({
          select: { city: true },
          distinct: ["city"],
        });
        configs.forEach(({ city }) => cities.add(city));
      }
      for (const city of cities) {
        try {
          const existing = await prisma.weatherCache.findUnique({
            where: { city },
            select: { fetchedAt: true },
          });
          if (
            existing &&
            Date.now() - existing.fetchedAt.getTime() < 29 * 60_000
          )
            continue;
          const payload = await provider.current(city);
          await prisma.weatherCache.upsert({
            where: { city },
            create: { city, payload },
            update: { payload, fetchedAt: new Date() },
          });
        } catch {
          app.log.warn("Weather refresh failed for a configured city");
        }
      }
    } catch {
      app.log.error("Weather refresh failed");
    }
  }
  const jobs = [
    schedule("*/15 * * * *", news, { noOverlap: true }),
    schedule("*/30 * * * *", weather, { noOverlap: true }),
  ];
  const ready = configureSources()
    .then(() => Promise.all(jobs.map((job) => job.execute())))
    .catch(() => {
      app.log.error("Content sources configuration failed");
    });
  return async () => {
    await ready;
    await Promise.all(jobs.map((job) => job.destroy()));
  };
}
