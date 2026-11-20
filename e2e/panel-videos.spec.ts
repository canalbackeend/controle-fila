import { expect, test } from "./fixture";

test("configures a quiet scene and resumes the same video after a ticket call", async ({
  page,
  unit,
}) => {
  test.setTimeout(60000);
  const created = await unit.request.post("/api/admin/devices", {
    data: { name: "TV com vídeos", type: "PANEL" },
  });
  expect(created.ok()).toBeTruthy();
  const { device, code } = await created.json();
  const configPath = `/api/admin/panels/${device.id}`;
  const configured = await unit.request.put(configPath, {
    data: {
      serviceIds: [],
      weights: { NOTICE: 0, NEWS: 0, WEATHER: 0, TIP: 0 },
      cardSeconds: 5,
      city: "São Paulo",
      state: "SP",
      callDisplaySeconds: 2,
      ticker: "",
    },
  });
  expect(configured.ok()).toBeTruthy();
  await unit.login(page);
  await page.getByRole("link", { name: "Dispositivos", exact: true }).click();
  await page.getByRole("link", { name: "Configurar TV e clima" }).click();
  await page.getByRole("checkbox", { name: "Ondas nas rochas" }).check();
  await page.getByRole("checkbox", { name: "Rio com neblina" }).check();
  await page.getByRole("button", { name: "Subir Rio com neblina" }).click();
  await page.getByLabel("Cartões entre vídeos").fill("1");
  await page.getByRole("button", { name: "Salvar vídeos" }).click();
  await expect(page.getByText("Programação de vídeos salva.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Rio com neblina" }),
  ).toBeChecked();
  await expect(page.getByLabel("Cartões entre vídeos")).toHaveValue("1");
  const configuration = await (await unit.request.get(configPath)).json();
  expect(configuration.config.sceneIds).toEqual(["misty-river", "ocean-waves"]);

  const fixture = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 45;
    const context = canvas.getContext("2d")!;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8",
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const stopped = new Promise<void>(
      (resolve) => (recorder.onstop = () => resolve()),
    );
    recorder.start();
    let frame = 0;
    const interval = setInterval(() => {
      context.fillStyle = frame++ % 2 ? "#245" : "#264";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }, 100);
    await new Promise((resolve) => setTimeout(resolve, 8000));
    clearInterval(interval);
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  const { videoCatalog } = configuration;
  const videoUrl = "/api/scene-videos/misty-river";
  await page.route("**" + videoUrl, (route) =>
    route.fulfill({ contentType: "video/webm", body: Buffer.from(fixture) }),
  );
  await page.route(`**/api/panel/${device.id}`, async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    const scenes = json.config.sceneIds.map((id: string) => ({
      ...videoCatalog.find((scene: { id: string }) => scene.id === id),
      videoUrl,
    }));
    await route.fulfill({ response, json: { ...json, scenes } });
  });

  const state = await (await unit.request.get("/api/attendant")).json();
  const serviceId = state.services[0].id;
  expect(
    (
      await unit.request.post("/api/attendant/shift", {
        data: { counterId: state.counters[0].id, serviceIds: [serviceId] },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await unit.request.post("/api/queue/tickets", {
        data: { serviceId, priority: "NORMAL" },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto(`/painel/${device.id}`);
  await page.getByLabel("Código de pareamento").fill(code);
  await page.getByRole("button", { name: "Parear dispositivo" }).click();
  await page.getByRole("button", { name: "Toque para iniciar" }).click();
  const video = page.locator("video");
  await expect(video).toBeVisible({ timeout: 9000 });
  await expect(video).toHaveJSProperty("muted", true);
  await expect(page.getByText("Um momento de calma")).toBeVisible();
  const timeBefore = await video.evaluate(
    (element: HTMLVideoElement) => element.currentTime,
  );
  expect(
    (await unit.request.post("/api/queue/call", { data: {} })).ok(),
  ).toBeTruthy();
  const call = page.getByRole("region", { name: "Chamada em destaque" });
  await expect(call).toBeVisible();
  await expect(video).toHaveJSProperty("paused", true);
  const pausedAt = await video.evaluate(
    (element: HTMLVideoElement) => element.currentTime,
  );
  expect(pausedAt).toBeGreaterThanOrEqual(timeBefore);
  await expect(call).toHaveCount(0);
  await expect(video).toHaveJSProperty("paused", false);
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(pausedAt);
  await video.dispatchEvent("error");
  await expect(
    page.getByRole("heading", { name: "Aguarde sua chamada" }),
  ).toBeVisible();
});
