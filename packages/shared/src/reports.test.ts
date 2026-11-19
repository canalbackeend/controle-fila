import { expect, test } from "vitest";
import { dayStartUtc, nextDay, reportInput } from "./reports.js";

test("converts inclusive local dates across daylight saving changes", () => {
  const day = "2026-03-08";
  expect(dayStartUtc(day, "America/New_York").toISOString()).toBe(
    "2026-03-08T05:00:00.000Z",
  );
  expect(dayStartUtc(nextDay(day), "America/New_York").toISOString()).toBe(
    "2026-03-09T04:00:00.000Z",
  );
  expect(dayStartUtc("2026-12-31", "America/Sao_Paulo").toISOString()).toBe(
    "2026-12-31T03:00:00.000Z",
  );
  expect(
    reportInput.safeParse({ from: "2026-01-01", to: "2026-05-01" }).success,
  ).toBe(false);
});
