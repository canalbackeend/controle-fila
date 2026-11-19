import type { WeatherLocation } from "@beend/shared";
import { prisma } from "../../db.js";
import { configuredWeatherProvider, weatherCacheKey } from "./weather.js";

const pending = new Map<string, Promise<boolean>>();

export function refreshWeather(location: WeatherLocation) {
  const provider = configuredWeatherProvider();
  if (!provider) return Promise.resolve(false);
  const city = weatherCacheKey(location);
  const active = pending.get(city);
  if (active) return active;
  const update = (async () => {
    const existing = await prisma.weatherCache.findUnique({ where: { city } });
    if (existing && Date.now() - existing.fetchedAt.getTime() < 29 * 60_000)
      return false;
    const value = existing?.payload;
    const savedQuery =
      value && typeof value === "object" && "locationQuery" in value
        ? value.locationQuery
        : undefined;
    const payload = await provider.current(
      location,
      typeof savedQuery === "string" ? savedQuery : undefined,
    );
    await prisma.weatherCache.upsert({
      where: { city },
      create: { city, payload },
      update: { payload, fetchedAt: new Date() },
    });
    return true;
  })().finally(() => pending.delete(city));
  pending.set(city, update);
  return update;
}
