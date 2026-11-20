import { expect, test } from "vitest";
import { articlesFor, helpArticles } from "./articles";

const ids = (list: { id: string }[]) => list.map(({ id }) => id);

test("shows attendants only the articles meant for them", () => {
  const visible = ids(articlesFor("ATTENDANT"));
  expect(visible).toContain("atendimento");
  expect(visible).toContain("celular");
  expect(visible).not.toContain("totem");
  expect(visible).not.toContain("plataforma");
});

test("keeps the Beend platform guide away from company administrators", () => {
  const visible = ids(articlesFor("ADMIN"));
  expect(visible).toContain("painel-tv");
  expect(visible).not.toContain("plataforma");
  expect(ids(articlesFor("SUPERADMIN"))).toEqual(ids(helpArticles));
});

test("searches every section ignoring accents and letter case", () => {
  expect(ids(articlesFor("ADMIN", "IMPRESSAO termica"))).toEqual([
    "totem",
    "problemas",
  ]);
  expect(ids(articlesFor("ATTENDANT", "IMPRESSAO termica"))).toEqual([
    "problemas",
  ]);
  expect(ids(articlesFor("ADMIN", "voz portugues"))).toEqual([
    "painel-tv",
    "problemas",
  ]);
  expect(articlesFor("ATTENDANT", "superadministrador inexistente")).toEqual(
    [],
  );
});

test("gives every article a unique address", () => {
  expect(new Set(ids(helpArticles)).size).toBe(helpArticles.length);
});
