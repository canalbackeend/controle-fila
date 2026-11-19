import { z } from "zod";
import type { DisplayCard } from "@beend/shared";
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

export interface WeatherProvider {
  current(city: string): Promise<WeatherData>;
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

  async current(city: string): Promise<WeatherData> {
    const url = new URL("https://api.weatherapi.com/v1/forecast.json");
    url.search = new URLSearchParams({
      key: this.key,
      q: city,
      days: "7",
      lang: "pt",
      aqi: "no",
      alerts: "no",
    }).toString();
    const result = responseSchema.parse(
      JSON.parse((await remoteContent(url, 256_000)).toString()),
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
    };
  }
}

export function configuredWeatherProvider(): WeatherProvider | null {
  const key = process.env.WEATHER_API_KEY;
  return process.env.WEATHER_PROVIDER === "weatherapi" && key
    ? new WeatherApi(key)
    : null;
}

export function weatherCard(city: string, weather: WeatherData): DisplayCard {
  return {
    id: `weather:${city}`,
    type: "WEATHER",
    title: city,
    text: weather.description,
    weather,
    source: weather.source,
  };
}
