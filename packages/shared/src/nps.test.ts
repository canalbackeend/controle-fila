import { expect, test } from "vitest";
import { npsInput, npsSummary } from "./nps.js";

test("classifies promoters, passives and detractors and computes the score", () => {
  expect(npsSummary([10, 9, 9, 8, 7, 6, 0, 10, 3, 9])).toEqual({
    total: 10,
    promoters: 5,
    passives: 2,
    detractors: 3,
    score: 20,
  });
});

test("rounds the score and handles unanimous answers", () => {
  expect(npsSummary([9, 9, 6]).score).toBe(33);
  expect(npsSummary([10, 10]).score).toBe(100);
  expect(npsSummary([0, 5, 6]).score).toBe(-100);
});

test("has no score without answers", () => {
  expect(npsSummary([])).toEqual({
    total: 0,
    promoters: 0,
    passives: 0,
    detractors: 0,
    score: null,
  });
});

test("accepts only whole scores from 0 to 10 and an optional short comment", () => {
  expect(npsInput.parse({ score: 0 })).toEqual({ score: 0 });
  expect(npsInput.parse({ score: 10, comment: "  Ótimo  " })).toEqual({
    score: 10,
    comment: "Ótimo",
  });
  expect(npsInput.parse({ score: 7, comment: "   " })).toEqual({ score: 7 });
  for (const score of [-1, 11, 7.5, "8"])
    expect(npsInput.safeParse({ score }).success).toBe(false);
  expect(
    npsInput.safeParse({ score: 5, comment: "x".repeat(501) }).success,
  ).toBe(false);
});
