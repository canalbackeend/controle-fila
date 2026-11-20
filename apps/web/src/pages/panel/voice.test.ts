import { expect, test } from "vitest";
import { callAnnouncement, pickVoice } from "./voice";

test("spells the ticket code in Brazilian Portuguese and names the counter", () => {
  expect(callAnnouncement({ code: "A001", counter: "Guichê 2" })).toBe(
    "Senha: a, zero, zero, um. Guichê 2.",
  );
  expect(callAnnouncement({ code: "PR120", counter: "Consultório 4" })).toBe(
    "Senha: pê, erre, um, dois, zero. Consultório 4.",
  );
});

test("announces the short name when the service calls by name", () => {
  expect(
    callAnnouncement({
      code: "A007",
      counter: "Sala 1",
      displayName: "Maria S.",
    }),
  ).toBe("Maria S. Sala 1.");
});

test("adds the counter word when the counter is only a number", () => {
  expect(callAnnouncement({ code: "B010", counter: "5" })).toBe(
    "Senha: bê, zero, um, zero. Guichê 5.",
  );
});

test("prefers a Brazilian Portuguese voice and never picks another language", () => {
  const english = { lang: "en-US", name: "English" };
  const portugal = { lang: "pt-PT", name: "Portugal" };
  const brazil = { lang: "pt_BR", name: "Brasil" };
  expect(pickVoice([english, portugal, brazil])).toBe(brazil);
  expect(pickVoice([english, portugal])).toBe(portugal);
  expect(pickVoice([english])).toBeUndefined();
});
