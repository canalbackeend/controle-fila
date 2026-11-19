import { afterEach, expect, test, vi } from "vitest";
import { remoteContent } from "./remote.js";
import { configuredWeatherProvider, weatherCacheKey } from "./weather.js";

vi.mock("./remote.js", () => ({ remoteContent: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

test("forecasts the selected state for a homonymous city and reuses its coordinates", async () => {
  vi.stubEnv("WEATHER_PROVIDER", "weatherapi");
  vi.stubEnv("WEATHER_API_KEY", "test-key");
  const weather = vi.mocked(remoteContent);
  const forecast = {
    current: { temp_c: 24, condition: { text: "Ensolarado" } },
    forecast: {
      forecastday: [
        {
          date: "2026-11-19",
          day: { mintemp_c: 15, maxtemp_c: 26 },
        },
      ],
    },
  };
  weather
    .mockResolvedValueOnce(
      Buffer.from(
        JSON.stringify([
          {
            name: "Bom Jesus",
            country: "Brazil",
            region: "Piaui",
            lat: -9.07,
            lon: -44.36,
          },
          {
            name: "Bom Jesus",
            country: "Brazil",
            region: "Rio Grande do Sul",
            lat: -28.67,
            lon: -50.43,
          },
        ]),
      ),
    )
    .mockResolvedValue(Buffer.from(JSON.stringify(forecast)));

  const location = { city: "Bom Jesus", state: "RS" } as const;
  const provider = configuredWeatherProvider()!;
  const result = await provider.current(location);
  expect(result).toMatchObject({
    temperature: 24,
    locationQuery: "-28.67,-50.43",
  });
  expect(weather.mock.calls[0]?.[0].pathname).toBe("/v1/search.json");
  expect(weather.mock.calls[1]?.[0].searchParams.get("q")).toBe(
    "-28.67,-50.43",
  );
  expect(weather.mock.calls[1]?.[0].searchParams.get("days")).toBe("3");
  await provider.current(location, result.locationQuery);
  expect(weather.mock.calls[2]?.[0].pathname).toBe("/v1/forecast.json");
  expect(weatherCacheKey(location)).not.toBe(
    weatherCacheKey({ ...location, state: "PI" }),
  );
});

test("does not fall back to a city in another state", async () => {
  vi.stubEnv("WEATHER_PROVIDER", "weatherapi");
  vi.stubEnv("WEATHER_API_KEY", "test-key");
  const weather = vi.mocked(remoteContent);
  weather.mockResolvedValue(
    Buffer.from(
      JSON.stringify([
        {
          name: "Bom Jesus",
          country: "Brazil",
          region: "Piaui",
          lat: -9.07,
          lon: -44.36,
        },
      ]),
    ),
  );
  await expect(
    configuredWeatherProvider()!.current({ city: "Bom Jesus", state: "RS" }),
  ).rejects.toThrow("City not found");
  expect(weather).toHaveBeenCalledTimes(1);
});

test("uses Recanto das Emas coordinates for the Federal District", async () => {
  vi.stubEnv("WEATHER_PROVIDER", "weatherapi");
  vi.stubEnv("WEATHER_API_KEY", "test-key");
  const weather = vi.mocked(remoteContent);
  weather.mockResolvedValueOnce(
    Buffer.from(
      JSON.stringify({
        current: { temp_c: 25, condition: { text: "Ensolarado" } },
        forecast: {
          forecastday: [
            {
              date: "2026-11-19",
              day: { mintemp_c: 17, maxtemp_c: 28 },
            },
          ],
        },
      }),
    ),
  );

  const result = await configuredWeatherProvider()!.current({
    city: "Recanto das emas",
    state: "DF",
  });
  expect(result.locationQuery).toBe("-15.90864,-48.06447");
  expect(weather).toHaveBeenCalledTimes(1);
  const [url] = weather.mock.calls[0]!;
  expect(url.pathname).toBe("/v1/forecast.json");
  expect(url.searchParams.get("q")).toBe("-15.90864,-48.06447");
});
