import { themeStyle } from "../../theme";
import { BrandLogo } from "../../components/BrandLogo";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { Socket } from "socket.io-client";
import {
  priorityLabels,
  type IssuedTicket,
  type KioskData,
  type Priority,
  type ServiceOption,
} from "@beend/shared";
import { ApiError, api } from "../../api";
import { Receipt } from "../../components/Receipt";
import { useRealtime } from "../../realtime";
import { PairingForm, usePairing } from "../devices/pairing";

function KioskDevice({ id }: { id: string }) {
  const { auth, token, pair, clear } = usePairing(id);
  const [suspended, setSuspended] = useState(false);
  const [data, setData] = useState<KioskData>();
  const [service, setService] = useState<ServiceOption>();
  const [ticket, setTicket] = useState<IssuedTicket>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{
    service: string;
    priority: Priority;
    key: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setData(await api<KioskData>(`/kiosk/${id}`, "GET", undefined, token));
      setSuspended(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setSuspended(true);
      if (error instanceof ApiError && error.status === 401) {
        clear();
        setData(undefined);
      }
    }
  }, [clear, id, token]);
  const configure = useCallback(
    (socket: Socket) => {
      socket.on("tenant.suspended", () => setSuspended(true));
      socket.on("tenant.theme", () => void refresh());
      socket.on("connect", () => void refresh());
      socket.on("disconnect", () => void refresh());
      socket.on("connect_error", () => void refresh());
    },
    [refresh],
  );
  const online = useRealtime(configure, auth, Boolean(token));
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const reset = useCallback(() => {
    setService(undefined);
    setTicket(undefined);
    setError("");
  }, []);
  useEffect(() => {
    if (busy || (!service && !ticket)) return;
    const timer = window.setTimeout(reset, 15000);
    return () => window.clearTimeout(timer);
  }, [busy, error, reset, service, ticket]);

  async function issue(priority: Priority) {
    if (!service || busy) return;
    if (
      pending.current?.service !== service.id ||
      pending.current.priority !== priority
    ) {
      pending.current = {
        service: service.id,
        priority,
        key: crypto.randomUUID(),
      };
    }
    setError("");
    setBusy(true);
    try {
      setTicket(
        await api<IssuedTicket>(
          `/kiosk/${id}/tickets`,
          "POST",
          { serviceId: service.id, priority, requestId: pending.current.key },
          token,
        ),
      );
      pending.current = null;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status < 500) pending.current = null;
        if (error.status === 401) clear();
      }
      setError(
        error instanceof ApiError && error.status === 429
          ? error.message
          : "Sistema indisponível, dirija-se ao balcão.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!token) return <PairingForm label="totem" pair={pair} />;
  if (suspended)
    return (
      <main className="kiosk">
        <section className="kiosk-content">
          <h1>Totem indisponível</h1>
          <p>O acesso desta empresa está suspenso.</p>
        </section>
      </main>
    );
  return (
    <main className="kiosk theme" style={themeStyle(data?.theme)}>
      <header>
        <span className="brand">
          <BrandLogo />
          {data?.unitName || "Beend Fila"}
        </span>
        {!online && (
          <span className="pill inactive" role="status">
            Reconectando…
          </span>
        )}
      </header>
      {ticket ? (
        <div className="kiosk-receipt">
          <h1>Senha emitida</h1>
          <Receipt ticket={ticket} close={reset} autoPrint />
        </div>
      ) : (
        <section className="kiosk-content">
          <h1>{service ? "Escolha o tipo de senha" : "Retire sua senha"}</h1>
          {service ? (
            <p>{service.name}</p>
          ) : (
            online && <p>Escolha um serviço para começar.</p>
          )}
          {(!online || error) && (
            <p role="alert" className="error">
              {error || "Sistema indisponível, dirija-se ao balcão."}
            </p>
          )}
          {online && !data && <p role="status">Carregando serviços…</p>}
          {online && data && !data.services.length && (
            <p>Nenhum serviço disponível. Dirija-se ao balcão.</p>
          )}
          <div className="kiosk-options">
            {service
              ? Object.entries(priorityLabels).map(([priority, name]) => (
                  <button
                    key={priority}
                    className="primary"
                    disabled={busy || !online}
                    onClick={() => void issue(priority as Priority)}
                  >
                    {busy ? "Emitindo…" : name}
                  </button>
                ))
              : data?.services.map((item) => (
                  <button
                    key={item.id}
                    className="primary"
                    disabled={!online}
                    onClick={() => setService(item)}
                  >
                    {item.name}
                  </button>
                ))}
          </div>
          {service && (
            <button
              className="kiosk-back"
              type="button"
              disabled={busy}
              onClick={reset}
            >
              Voltar
            </button>
          )}
        </section>
      )}
    </main>
  );
}

export function Kiosk() {
  const { id } = useParams<{ id: string }>();
  return id ? (
    <KioskDevice key={id} id={id} />
  ) : (
    <main className="workspace">
      <h1>Totem</h1>
      <p>Abra o endereço do dispositivo disponível na administração.</p>
    </main>
  );
}
