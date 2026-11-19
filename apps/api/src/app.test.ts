import { expect, test } from "vitest";
import { buildApp } from "./app.js";

test("reports liveness", async () => {
  const app = buildApp();
  try {
    const response = await app.inject("/health");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  } finally {
    await app.close();
  }
});
