import { expect, test } from "vitest";
import { contentTypes, pickPanelCard, type DisplayCard } from "./panel.js";

const cards: DisplayCard[] = contentTypes.map((type) => ({
  id: type,
  title: type,
  type,
  text: "",
}));

test("selects all four categories by configured weight independently of card count", () => {
  const weights = { NOTICE: 40, NEWS: 30, WEATHER: 20, TIP: 10 };
  for (const [index, draw] of [0.35, 0.55, 0.75, 0.95].entries()) {
    expect(
      pickPanelCard(
        [...cards, { ...cards[0]!, id: "Other notice" }],
        weights,
        undefined,
        () => draw,
      )?.type,
    ).toBe(contentTypes[index]);
  }
});

test("filters zero weight categories and prevents consecutive copies where possible", () => {
  const weights = { NOTICE: 100, NEWS: 0, WEATHER: 0, TIP: 5 };
  expect(pickPanelCard(cards, weights, "NOTICE", () => 0)?.id).toBe("TIP");
  expect(pickPanelCard([cards[0]!], weights, "NOTICE", () => 0)?.id).toBe(
    "NOTICE",
  );
  expect(
    pickPanelCard([cards[1]!], weights, undefined, () => 0),
  ).toBeUndefined();
});
