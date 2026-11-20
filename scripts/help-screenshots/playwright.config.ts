import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

if (existsSync(".env")) process.loadEnvFile(".env");
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5180";

/** Regenerates the help center screenshots: `pnpm help:screenshots`. */
export default defineConfig({
  testDir: ".",
  testMatch: "capture.spec.ts",
  workers: 1,
  timeout: 240_000,
  use: { baseURL, locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 30000,
      },
});
