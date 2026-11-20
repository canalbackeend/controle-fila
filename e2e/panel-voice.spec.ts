import { expect, test } from "./fixture";

test("announces calls by voice on TVs configured for it and keeps the beep otherwise", async ({
  page,
  unit,
}) => {
  const created = await unit.request.post("/api/admin/devices", {
    data: { name: "TV com voz", type: "PANEL" },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const { device, code } = await created.json();
  const configPath = `/api/admin/panels/${device.id}`;
  const settings = {
    serviceIds: [],
    weights: { NOTICE: 0, NEWS: 0, WEATHER: 0, TIP: 0 },
    cardSeconds: 10,
    city: "São Paulo",
    state: "SP",
    callDisplaySeconds: 3,
    ticker: "",
  };
  expect((await unit.request.put(configPath, { data: settings })).ok()).toBe(
    true,
  );
  expect(
    (await (await unit.request.get(configPath)).json()).config.callSound,
  ).toBe("BEEP");

  await unit.login(page);
  await page.getByRole("link", { name: "Dispositivos", exact: true }).click();
  await page.getByRole("link", { name: "Configurar TV e clima" }).click();
  await expect(page.getByRole("radio", { name: "Bip" })).toBeChecked();
  await page.getByRole("radio", { name: "Chamada de voz" }).check();
  await page.getByRole("button", { name: "Salvar painel" }).click();
  await expect(page.getByText("Configuração salva.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "Chamada de voz" }),
  ).toBeChecked();

  await page.addInitScript(() => {
    const spoken: string[] = [];
    Object.assign(window, { spoken });
    class Utterance {
      volume = 1;
      voice: unknown = null;
      lang = "";
      rate = 1;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: Utterance,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [{ lang: "pt-BR", name: "Voz de teste" }],
        speak: (utterance: Utterance) => {
          if (utterance.text) spoken.push(utterance.text);
        },
        cancel: () => {},
      },
    });
  });
  const spoken = () =>
    page.evaluate(() => (window as unknown as { spoken: string[] }).spoken);

  const state = await (await unit.request.get("/api/attendant")).json();
  const service = state.services[0];
  const counter = state.counters[0];
  expect(
    (
      await unit.request.post("/api/attendant/shift", {
        data: { counterId: counter.id, serviceIds: [service.id] },
      })
    ).ok(),
  ).toBeTruthy();
  const receipt = await unit.request.post("/api/queue/tickets", {
    data: { serviceId: service.id, priority: "NORMAL" },
  });
  expect(receipt.ok(), await receipt.text()).toBeTruthy();
  const ticket = await receipt.json();

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
  await expect.poll(spoken).toHaveLength(1);
  const [announcement] = await spoken();
  expect(announcement).toMatch(/^Senha: [a-zà-ú]+(, [a-zà-ú]+)+\./);
  expect(announcement).toContain(counter.name);
  await expect(overlay).toHaveCount(0, { timeout: 5000 });

  expect(
    (
      await unit.request.put(configPath, {
        data: { ...settings, callSound: "BEEP" },
      })
    ).ok(),
  ).toBeTruthy();
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key) ?? "{}").config?.callSound,
        `beend-panel-content:${device.id}`,
      ),
    )
    .toBe("BEEP");
  expect(
    (
      await unit.request.post(`/api/queue/tickets/${ticket.id}/action`, {
        data: { action: "RECALL" },
      })
    ).ok(),
  ).toBeTruthy();
  await expect(overlay.getByText("Rechamada")).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await spoken()).toHaveLength(1);
});
