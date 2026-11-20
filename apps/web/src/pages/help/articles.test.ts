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
  expect(ids(articlesFor("ADMIN", "bip mudo"))).toEqual(["painel-tv"]);
  expect(articlesFor("ATTENDANT", "superadministrador inexistente")).toEqual(
    [],
  );
});

test("gives every article a unique address", () => {
  expect(new Set(ids(helpArticles)).size).toBe(helpArticles.length);
});

test("illustrates the guides with existing images and uses every image", async () => {
  const { existsSync } = await import("node:fs");
  const { helpFigures } = await import("./figures");
  const used = new Set(
    helpArticles.flatMap((article) =>
      article.sections.flatMap((section) => section.figures ?? []),
    ),
  );
  expect([...used].sort()).toEqual(Object.keys(helpFigures).sort());
  for (const figure of Object.values(helpFigures)) {
    const file = new URL(
      `../../../public/help/${figure.file}`,
      import.meta.url,
    );
    expect(existsSync(file), figure.file).toBe(true);
  }
});

test("finds guides by what the illustrations show", () => {
  expect(ids(articlesFor("ADMIN", "letreiro com os avisos"))).toContain(
    "painel-tv",
  );
});
