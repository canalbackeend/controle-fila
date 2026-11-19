import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, test } from "vitest";
import { App } from "./App";

test("shows the product at the home route", () => {
  const markup = renderToStaticMarkup(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  expect(markup).toContain("Beend Fila");
});
