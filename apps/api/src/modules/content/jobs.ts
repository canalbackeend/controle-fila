import { schedule } from "node-cron";
import type { FastifyInstance } from "fastify";
import {
  defaultPanelSettings,
  weatherStateSchema,
  type WeatherLocation,
} from "@beend/shared";
import { prisma, tenantDb } from "../../db.js";
import { configureSources, refreshNews } from "./news.js";
import { configuredWeatherProvider, weatherCacheKey } from "./weather.js";
import { refreshWeather } from "./weather-cache.js";

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
      const tenants = await prisma.tenant.findMany({
        where: { suspendedAt: null },
        select: { id: true },
      });
      const cities = new Map<string, WeatherLocation>([
        [weatherCacheKey(defaultPanelSettings), defaultPanelSettings],
      ]);
      for (const { id } of tenants) {
        const configs = await tenantDb(id).panelConfig.findMany({
          where: { weights: { path: ["WEATHER"], gt: 0 } },
          select: { city: true, state: true },
          distinct: ["city", "state"],
        });
        for (const { city, state } of configs) {
          const location = {
            city,
            state: weatherStateSchema.safeParse(state).data ?? null,
          };
          cities.set(weatherCacheKey(location), location);
        }
      }
      for (const location of cities.values()) {
        try {
          await refreshWeather(location);
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
