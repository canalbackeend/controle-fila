import { expect, test } from "./fixture";

test("calls on the TV only beep while voice announcements are paused", async ({
  page,
  unit,
}) => {
  const created = await unit.request.post("/api/admin/devices", {
    data: { name: "TV sem voz", type: "PANEL" },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const { device, code } = await created.json();
  const configPath = `/api/admin/panels/${device.id}`;
  expect(
    (
      await unit.request.put(configPath, {
        data: {
          serviceIds: [],
          weights: { NOTICE: 0, NEWS: 0, WEATHER: 0, TIP: 0 },
          cardSeconds: 10,
          city: "São Paulo",
          state: "SP",
          callDisplaySeconds: 3,
          callSound: "VOICE",
          ticker: "",
        },
      })
    ).ok(),
  ).toBeTruthy();

  await unit.login(page);
  await page.goto(`/admin/painel/${device.id}`);
  await expect(
    page.getByRole("button", { name: "Salvar painel" }),
  ).toBeVisible();
  await expect(page.getByText("Som da chamada")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Chamada de voz" })).toHaveCount(
    0,
  );

  await page.addInitScript(() => {
    const spoken: string[] = [];
    Object.assign(window, { spoken });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [{ lang: "pt-BR", name: "Voz de teste" }],
        speak: (utterance: { text: string }) => spoken.push(utterance.text),
        cancel: () => {},
      },
    });
  });
  const state = await (await unit.request.get("/api/attendant")).json();
  const service = state.services[0];
  expect(
    (
      await unit.request.post("/api/attendant/shift", {
        data: { counterId: state.counters[0].id, serviceIds: [service.id] },
      })
    ).ok(),
  ).toBeTruthy();
  const ticket = await (
    await unit.request.post("/api/queue/tickets", {
      data: { serviceId: service.id, priority: "NORMAL" },
    })
  ).json();

  await page.goto(`/painel/${device.id}`);
  await page.getByLabel("Código de pareamento").fill(code);
  await page.getByRole("button", { name: "Parear dispositivo" }).click();
  await page.getByRole("button", { name: "Toque para iniciar" }).click();
  await expect(
    page.getByRole("heading", { name: "Aguarde sua chamada" }),
  ).toBeVisible();
  expect((await unit.request.post("/api/queue/call", { data: {} })).ok()).toBe(
    true,
  );
  const overlay = page.getByRole("region", { name: "Chamada em destaque" });
  await expect(overlay.getByText(ticket.code)).toBeVisible();
  await page.waitForTimeout(1500);
  expect(
    await page.evaluate(
      () => (window as unknown as { spoken: string[] }).spoken,
    ),
  ).toEqual([]);
});
