import { z } from "zod";
import {
  brazilianStates,
  type DisplayCard,
  type WeatherLocation,
} from "@beend/shared";
import { remoteContent } from "./remote.js";

export const weatherData = z.object({
  temperature: z.number(),
  description: z.string(),
  days: z.array(
    z.object({ day: z.iso.date(), min: z.number(), max: z.number() }),
  ),
  source: z.string(),
});
export type WeatherData = z.infer<typeof weatherData>;
type CachedWeather = WeatherData & { locationQuery?: string };

export interface WeatherProvider {
  current(
    location: WeatherLocation,
    previousQuery?: string,
  ): Promise<CachedWeather>;
}

const locationsSchema = z.array(
  z.object({
    name: z.string(),
    region: z.string(),
    country: z.string(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
);

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function weatherCacheKey({ city, state }: WeatherLocation) {
  return state ? `uf:${state}:${normalize(city)}` : city;
}

const responseSchema = z.object({
  current: z.object({
    temp_c: z.number(),
    condition: z.object({ text: z.string() }),
  }),
  forecast: z.object({
    forecastday: z.array(
      z.object({
        date: z.iso.date(),
        day: z.object({ mintemp_c: z.number(), maxtemp_c: z.number() }),
      }),
    ),
  }),
});

class WeatherApi implements WeatherProvider {
  constructor(private readonly key: string) {}

  private async fetchJson(
    endpoint: "search" | "forecast",
    params: Record<string, string>,
  ) {
    const url = new URL(`https://api.weatherapi.com/v1/${endpoint}.json`);
    url.search = new URLSearchParams({ ...params, key: this.key }).toString();
    return JSON.parse(
      (await remoteContent(url, 512_000)).toString(),
    ) as unknown;
  }

  private async coordinates({ city, state }: WeatherLocation) {
    if (!state) return city;
    const candidates = locationsSchema.parse(
      await this.fetchJson("search", { q: city }),
    );
    const region = normalize(brazilianStates[state]);
    const match = candidates.find((location) => {
      const stateName = normalize(location.region).replace(
        /^stateof|state$/g,
        "",
      );
      return (
        /^(brazil|brasil)$/.test(normalize(location.country)) &&
        normalize(location.name) === normalize(city) &&
        (stateName === region ||
          stateName === state.toLowerCase() ||
          (state === "DF" && stateName === "federaldistrict"))
      );
    });
    if (!match) throw new Error("City not found in selected state");
    return `${match.lat},${match.lon}`;
  }

  async current(
    location: WeatherLocation,
    previousQuery?: string,
  ): Promise<CachedWeather> {
    const locationQuery = previousQuery ?? (await this.coordinates(location));
    const result = responseSchema.parse(
      await this.fetchJson("forecast", {
        q: locationQuery,
        days: "3",
        lang: "pt",
        aqi: "no",
        alerts: "no",
      }),
    );
    return {
      temperature: result.current.temp_c,
      description: result.current.condition.text,
      days: result.forecast.forecastday.map(({ date, day }) => ({
        day: date,
        min: day.mintemp_c,
        max: day.maxtemp_c,
      })),
      source: "WeatherAPI.com",
      locationQuery,
    };
  }
}

export function configuredWeatherProvider(): WeatherProvider | null {
  const key = process.env.WEATHER_API_KEY;
  return process.env.WEATHER_PROVIDER === "weatherapi" && key
    ? new WeatherApi(key)
    : null;
}

export function weatherCard(
  location: WeatherLocation,
  weather: WeatherData,
): DisplayCard {
  return {
    id: `weather:${weatherCacheKey(location)}`,
    type: "WEATHER",
    title: location.state
      ? `${location.city}, ${location.state}`
      : location.city,
    text: weather.description,
    weather,
    source: weather.source,
  };
}
