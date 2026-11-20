import { themeStyle } from "../../theme";
import { BrandLogo } from "../../components/BrandLogo";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { Socket } from "socket.io-client";
import {
  defaultPanelSettings,
  advancePanelRotation,
  type DisplayCard,
  type PanelCall,
  type PanelData,
  type PanelScene,
  type PanelSceneId,
} from "@beend/shared";
import { ApiError, api } from "../../api";
import { useRealtime } from "../../realtime";
import { PairingForm, usePairing } from "../devices/pairing";
import { FullscreenButton } from "../devices/FullscreenButton";
import { VideoScene } from "./VideoScene";
import { playAlert } from "./sound";
import { speakCall, stopSpeech, unlockSpeech } from "./voice";

const cardLabels = {
  NOTICE: "Aviso",
  NEWS: "Notícia",
  WEATHER: "Previsão do tempo",
  TIP: "Dica",
};
const fallback: DisplayCard = {
  id: "welcome",
  type: "TIP",
  title: "Aguarde sua chamada",
  text: "Confira o código da sua senha e o guichê indicado no painel.",
};
const zone = "America/Sao_Paulo";
const emptyCards: DisplayCard[] = [];
const emptyScenes: PanelScene[] = [];

function readCache(key: string): PanelData | undefined {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? undefined;
  } catch {
    return undefined;
  }
}

function Clock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="tv-clock">
      <time dateTime={now.toISOString()}>
        {new Intl.DateTimeFormat("pt-BR", {
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
        }).format(now)}
      </time>
      <span>
        {new Intl.DateTimeFormat("pt-BR", {
          timeZone,
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(now)}
      </span>
    </div>
  );
}

function CallText({ call }: { call: PanelCall }) {
  return (
    <>
      {call.displayName && <p className="tv-call-name">{call.displayName}</p>}
      <strong className="tv-call-code">{call.code}</strong>
      <span className="tv-destination">{call.counter}</span>
    </>
  );
}

function Card({ card }: { card: DisplayCard }) {
  const { imageCredit } = card;
  return (
    <article
      className={`tv-card ${card.type === "NEWS" ? "tv-news" : ""} ${card.imageUrl ? "with-image" : ""}`}
      key={card.id}
    >
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
      <div className="tv-card-copy">
        {card.id !== "welcome" && (
          <p className="tv-topic">{cardLabels[card.type]}</p>
        )}
        <h2>{card.title}</h2>
        {card.text && <p>{card.text}</p>}
        {card.weather && (
          <div className="tv-weather">
            <strong>
              <span aria-hidden="true">◐</span>{" "}
              {Math.round(card.weather.temperature)}°C
            </strong>
            <ul>
              {card.weather.days.map((day) => (
                <li key={day.day}>
                  <b>
                    {new Intl.DateTimeFormat("pt-BR", {
                      timeZone: "UTC",
                      weekday: "short",
                    }).format(new Date(day.day + "T00:00:00Z"))}
                  </b>
                  <span>
                    {Math.round(day.min)}° / {Math.round(day.max)}°
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {card.source && (
          <p className="tv-source">
            {card.sourceUrl ? (
              <a href={card.sourceUrl} target="_blank" rel="noreferrer">
                {card.source}
              </a>
            ) : (
              card.source
            )}
            {card.sourceLicenseUrl && (
              <>
                {" "}
                ·{" "}
                <a
                  href={card.sourceLicenseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY-ND 3.0
                </a>
              </>
            )}
          </p>
        )}
      </div>
      {imageCredit && (
        <p className="tv-photo-credit">
          Foto ilustrativa recortada ·{" "}
          <a href={imageCredit.sourceUrl} target="_blank" rel="noreferrer">
            {imageCredit.author}
          </a>{" "}
          ·{" "}
          <a href={imageCredit.licenseUrl} target="_blank" rel="noreferrer">
            {imageCredit.license}
          </a>
        </p>
      )}
    </article>
  );
}

function PanelDevice({ id }: { id: string }) {
  const { auth, token, pair, clear } = usePairing(id);
  const key = `beend-panel-content:${id}`;
  const [data, setData] = useState(() => readCache(key));
  const [history, setHistory] = useState<PanelCall[]>([]);
  const [overlay, setOverlay] = useState<PanelCall[]>([]);
  const [rotation, setRotation] = useState(() =>
    advancePanelRotation(
      data?.cards ?? [],
      data?.config.weights ?? defaultPanelSettings.weights,
    ),
  );
  const [suspended, setSuspended] = useState(false);
  const [started, setStarted] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [sceneId, setSceneId] = useState<PanelSceneId>();
  const slidesSinceVideo = useRef(0);
  const lastSceneId = useRef<PanelSceneId>(undefined);
  const audio = useRef<AudioContext | null>(null);
  const seen = useRef<string[]>([]);
  const current = overlay[0];
  const config = data?.config ?? defaultPanelSettings;
  const cards = data?.cards ?? emptyCards;
  const scenes = data?.scenes ?? emptyScenes;
  const scene = scenes.find(({ id }) => id === sceneId);
  const card = cards.find(({ id }) => id === rotation.id) ?? fallback;

  const merge = useCallback((newCalls: PanelCall[]) => {
    setHistory((previous) =>
      [
        ...new Map(
          [...previous, ...newCalls].map((item) => [item.id, item]),
        ).values(),
      ]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 5),
    );
  }, []);
  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const next = await api<PanelData>(
        `/panel/${id}`,
        "GET",
        undefined,
        token,
      );
      setSuspended(false);
      const content = { ...next, calls: [] };
      setData((previous) =>
        JSON.stringify(previous) === JSON.stringify(content)
          ? previous
          : content,
      );
      setRotation((previous) =>
        next.cards.some(({ id }) => id === previous.id)
          ? previous
          : advancePanelRotation(next.cards, next.config.weights, previous),
      );
      setSceneId((previous) =>
        next.scenes?.some(({ id }) => id === previous) ? previous : undefined,
      );
      merge(next.calls);
      try {
        localStorage.setItem(key, JSON.stringify(content));
      } catch {
        /* Memory remains available. */
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setSuspended(true);
        setOverlay([]);
        setHistory([]);
      }
      if (error instanceof ApiError && error.status === 401) {
        clear();
        localStorage.removeItem(key);
        setData(undefined);
        setOverlay([]);
        setHistory([]);
      }
    }
  }, [clear, id, key, merge, token]);
  const configure = useCallback(
    (socket: Socket) => {
      socket.on("tenant.suspended", () => {
        setSuspended(true);
        setOverlay([]);
        setHistory([]);
      });
      socket.on("tenant.theme", () => void refresh());
      socket.on("connect", () => void refresh());
      socket.on("disconnect", () => void refresh());
      socket.on("connect_error", () => void refresh());
      socket.on("panel.config", () => void refresh());
      socket.on("panel.content", () => void refresh());
      socket.on("ticket.called", (call: PanelCall) => {
        if (seen.current.includes(call.id)) return;
        seen.current = [...seen.current.slice(-99), call.id];
        merge([call]);
        setOverlay((queue) => [...queue, call]);
      });
    },
    [merge, refresh],
  );
  const online = useRealtime(configure, auth, Boolean(token));

  useEffect(() => {
    if (!token) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(timer);
  }, [refresh, token]);
  useEffect(() => {
    return () => {
      void audio.current?.close().catch(() => {});
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let active = true;
    void navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        if (!active) return;
        const paths = [
          data?.logoUrl,
          ...cards.map((card) => card.imageUrl),
        ].filter(Boolean);
        if (paths.length)
          registration.active?.postMessage({ type: "CACHE_IMAGES", paths });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [cards, data?.logoUrl]);
  const advanceCard = useCallback(() => {
    setRotation((previous) =>
      advancePanelRotation(cards, config.weights, previous),
    );
  }, [cards, config.weights]);
  const finishScene = useCallback(() => {
    setSceneId(undefined);
    advanceCard();
  }, [advanceCard]);
  useEffect(() => {
    if (!started || current || scene) return;
    const timer = window.setTimeout(() => {
      slidesSinceVideo.current = Math.min(slidesSinceVideo.current + 1, 10);
      if (
        scenes.length &&
        (!cards.length || slidesSinceVideo.current >= config.sceneFrequency)
      ) {
        const index =
          (scenes.findIndex(({ id }) => id === lastSceneId.current) + 1) %
          scenes.length;
        lastSceneId.current = scenes[index]?.id;
        slidesSinceVideo.current = 0;
        setSceneId(scenes[index]?.id);
      } else {
        advanceCard();
      }
    }, config.cardSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [
    advanceCard,
    cards.length,
    config.cardSeconds,
    config.sceneFrequency,
    current,
    started,
    rotation,
    scene,
    scenes,
  ]);
  const callSound = useRef(config.callSound);
  callSound.current = config.callSound;
  useEffect(() => {
    if (!started || !current) return;
    if (audio.current) playAlert(audio.current);
    const voice =
      callSound.current === "VOICE"
        ? window.setTimeout(() => speakCall(current), 700)
        : undefined;
    const timer = window.setTimeout(
      () => setOverlay((queue) => queue.slice(1)),
      config.callDisplaySeconds * 1000,
    );
    return () => {
      window.clearTimeout(voice);
      window.clearTimeout(timer);
    };
  }, [config.callDisplaySeconds, current, started]);
  useEffect(() => stopSpeech, []);

  async function start() {
    try {
      if (!audio.current) audio.current = new AudioContext();
      unlockSpeech();
      await audio.current.resume();
      if (audio.current.state !== "running")
        throw new Error("Audio unavailable");
      setStarted(true);
    } catch {
      setAudioError(
        "O navegador não liberou o áudio. Toque novamente para iniciar.",
      );
    }
  }

  if (!token) return <PairingForm label="painel de TV" pair={pair} />;
  if (suspended)
    return (
      <main className="tv-screen tv-start">
        <FullscreenButton floating dark />
        <div>
          <h1>Painel indisponível</h1>
          <p>O acesso desta empresa está suspenso.</p>
        </div>
      </main>
    );
  if (!started)
    return (
      <main
        className="tv-screen tv-start theme"
        style={themeStyle(data?.theme)}
      >
        <FullscreenButton floating dark />
        <div>
          <p>{data?.unitName || "Beend Fila"}</p>
          <h1>Painel de chamadas</h1>
          <button className="primary" onClick={() => void start()}>
            Toque para iniciar
          </button>
          {audioError && <p role="alert">{audioError}</p>}
        </div>
      </main>
    );
  const [latest, ...previous] = history.filter(
    ({ serviceId }) =>
      !config.serviceIds.length || config.serviceIds.includes(serviceId),
  );
  return (
    <main className="tv-screen theme" style={themeStyle(data?.theme)}>
      <header className="tv-header">
        <span className="brand">
          {data?.logoUrl ? (
            <img className="tv-logo" src={data.logoUrl} alt="" />
          ) : (
            <BrandLogo onDark />
          )}
          {data?.unitName || "Beend Fila"}
        </span>
        <div className="tv-meta">
          {!online && (
            <span className="tv-offline" role="status">
              Sem conexão
            </span>
          )}
          {data?.temperature !== undefined && (
            <span className="tv-temperature">
              {Math.round(data.temperature)}°C
              {data.weatherSource && <small>{data.weatherSource}</small>}
            </span>
          )}
          <Clock timeZone={data?.timeZone || zone} />
          <FullscreenButton dark />
        </div>
      </header>
      <div className="tv-layout">
        <aside className="tv-queue" aria-label="Chamadas">
          <div className="tv-current">
            <p className="tv-topic">Última chamada</p>
            {latest ? (
              <CallText call={latest} />
            ) : (
              <p className="tv-awaiting">Aguardando chamadas</p>
            )}
          </div>
          <h2>Chamadas anteriores</h2>
          {previous.length > 0 && (
            <ul>
              {previous.map((call) => (
                <li key={call.id}>
                  <strong>{call.code}</strong>
                  <span>{call.counter}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
        {scene ? (
          <VideoScene
            key={scene.id}
            scene={scene}
            paused={Boolean(current)}
            onFinish={finishScene}
          />
        ) : (
          <Card card={card} />
        )}
      </div>
      <footer className="tv-ticker">
        <div className={`tv-ticker-track${config.ticker ? " scrolling" : ""}`}>
          <span>{config.ticker || "Acompanhe as chamadas neste painel."}</span>
          {config.ticker && <span aria-hidden="true">{config.ticker}</span>}
        </div>
      </footer>
      {current && (
        <section
          className="tv-overlay"
          aria-label="Chamada em destaque"
          aria-live="assertive"
        >
          <p className="tv-topic">
            {current.isRecall ? "Rechamada" : "Senha chamada"}
          </p>
          <CallText call={current} />
        </section>
      )}
    </main>
  );
}

export function Panel() {
  const { id } = useParams<{ id: string }>();
  return id ? (
    <PanelDevice key={id} id={id} />
  ) : (
    <main className="workspace">
      <h1>Painel de TV</h1>
      <p>Abra o endereço do dispositivo disponível na administração.</p>
    </main>
  );
}
