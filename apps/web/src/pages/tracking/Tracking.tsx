import { themeStyle } from "../../theme";
import { BrandLogo } from "../../components/BrandLogo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { Socket } from "socket.io-client";
import {
  publicTokenSchema,
  ticketStatusLabels,
  type TrackingData,
} from "@beend/shared";
import { ApiError, api } from "../../api";
import { useRealtime } from "../../realtime";

type Permission = NotificationPermission | "unsupported";

function notificationPermission(): Permission {
  return typeof Notification === "undefined" || !window.isSecureContext
    ? "unsupported"
    : Notification.permission;
}

async function sendNotification(title: string, body: string, tag: string) {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration?.active)
      await registration.showNotification(title, { body, tag });
    else new Notification(title, { body, tag });
  } catch {
    /* The tracking page remains the source of the current status. */
  }
}

function Tracker({ token }: { token: string }) {
  const [data, setData] = useState<TrackingData>();
  const [status, setStatus] = useState<
    "loading" | "ok" | "expired" | "missing" | "offline"
  >("loading");
  const [permission, setPermission] = useState(notificationPermission);
  const [threshold, setThreshold] = useState(3);
  const notified = useRef<{ near: string | null; called: string | null }>({
    near: null,
    called: null,
  });
  const generation = useRef(0);
  const auth = useMemo(() => ({ publicToken: token }), [token]);

  const refresh = useCallback(async () => {
    const index = ++generation.current;
    try {
      const next = await api<TrackingData>(`/track/${token}`);
      if (index !== generation.current) return;
      setData(next);
      setStatus("ok");
    } catch (error) {
      if (index !== generation.current) return;
      if (error instanceof ApiError && [400, 404, 410].includes(error.status)) {
        setData(undefined);
        setStatus(error.status === 410 ? "expired" : "missing");
      } else setStatus("offline");
    }
  }, [token]);

  const configure = useCallback(
    (socket: Socket) => {
      const update = () => void refresh();
      socket.on("connect", update);
      socket.on("tenant.theme", update);
      socket.on("queue.changed", update);
      socket.on("ticket.updated", update);
    },
    [refresh],
  );
  const active = status !== "expired" && status !== "missing";
  const done =
    data && ["FINISHED", "NO_SHOW", "CANCELED"].includes(data.status);
  const online = useRealtime(configure, auth, active && !done);
  useEffect(() => {
    if (!active) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      generation.current++;
      window.clearInterval(timer);
    };
  }, [active, refresh]);

  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (!data || status !== "ok" || permission !== "granted") return;
    const service = data.service.id;
    if (data.status === "CALLED" && notified.current.called !== service) {
      notified.current.called = service;
      void sendNotification(
        `Senha ${data.code} chamada`,
        data.counterNumber
          ? `Dirija-se ao guichê ${data.counterNumber}.`
          : "Confira o painel de chamadas.",
        `beend-${token}-called`,
      );
    }
    if (
      data.status === "WAITING" &&
      data.peopleAhead <= threshold &&
      notified.current.near !== service
    ) {
      notified.current.near = service;
      const count = data.peopleAhead;
      void sendNotification(
        `Sua vez está próxima · ${data.code}`,
        count
          ? `${count} ${count === 1 ? "pessoa à frente" : "pessoas à frente"}.`
          : "Você está no início da fila.",
        `beend-${token}-near`,
      );
    }
  }, [data, permission, status, threshold, token]);

  async function enableNotifications() {
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission("unsupported");
    }
  }

  return (
    <main className="tracking theme" style={themeStyle(data?.theme)}>
      <header className="tracking-header">
        <BrandLogo />
      </header>
      <h1>Acompanhe sua senha</h1>
      {status === "loading" && !data && (
        <p role="status">Carregando sua senha…</p>
      )}
      {status === "expired" && (
        <section className="surface tracking-card">
          <h2>Senha expirada</h2>
          <p>O acompanhamento termina no fim do dia de atendimento.</p>
        </section>
      )}
      {status === "missing" && (
        <section className="surface tracking-card">
          <h2>Senha indisponível</h2>
          <p>Confira o QR Code do comprovante.</p>
        </section>
      )}
      {status === "offline" && (
        <p className="error" role="alert">
          Sem conexão. Tentando atualizar sua senha…
        </p>
      )}
      {data && (
        <>
          <section className="surface tracking-card" aria-live="polite">
            <div className="tracking-unit">
              <p>{data.unitName}</p>
              {!online && !done && (
                <span className="pill inactive">Reconectando…</span>
              )}
            </div>
            <div>
              <p className="eyebrow">{data.service.name}</p>
              <h2 className="tracking-code">{data.code}</h2>
            </div>
            <span className="pill">{ticketStatusLabels[data.status]}</span>
            {data.status === "WAITING" && (
              <div className="tracking-position">
                <strong>{data.peopleAhead}</strong>
                <p>
                  {data.peopleAhead === 1
                    ? "pessoa à frente"
                    : "pessoas à frente"}
                </p>
              </div>
            )}
            {data.counterNumber !== undefined && (
              <p className="tracking-counter">Guichê {data.counterNumber}</p>
            )}
          </section>
          {!done && permission !== "unsupported" && (
            <section className="surface tracking-card tracking-notifications">
              <h2>Notificações</h2>
              {permission === "default" && (
                <>
                  <p>
                    Receba um aviso quando sua vez se aproximar e quando sua
                    senha for chamada.
                  </p>
                  <button
                    className="primary"
                    onClick={() => void enableNotifications()}
                  >
                    Ativar notificações
                  </button>
                </>
              )}
              {permission === "denied" && (
                <p>
                  As notificações estão bloqueadas nas configurações do
                  navegador.
                </p>
              )}
              {permission === "granted" && (
                <>
                  <p>Mantenha a página aberta para receber os avisos.</p>
                  <label>
                    Avisar quando restarem
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={threshold}
                      onChange={(event) =>
                        setThreshold(
                          Math.max(
                            0,
                            Math.min(20, Number(event.currentTarget.value)),
                          ),
                        )
                      }
                    />
                  </label>
                </>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}

export function Tracking() {
  const { token } = useParams();
  return publicTokenSchema.safeParse(token).success ? (
    <Tracker key={token} token={token!} />
  ) : (
    <main className="tracking">
      <h1>Senha indisponível</h1>
      <p>Confira o QR Code do comprovante.</p>
    </main>
  );
}
