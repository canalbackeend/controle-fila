import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { Socket } from "socket.io-client";
import {
  priorityLabels,
  ticketStatusLabels,
  type Actor,
  type AttendantState,
  type TicketAction,
} from "@beend/shared";
import { api, message } from "../../api";
import { useRealtime } from "../../realtime";

function waitTime(value: string | null, now: number) {
  if (!value) return "—";
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(value).getTime()) / 60000),
  );
  return minutes ? `${minutes} min` : "< 1 min";
}

export function Attendant({ actor }: { actor: Actor }) {
  const [state, setState] = useState<AttendantState>();
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forward, setForward] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const index = ++generation.current;
    const snapshot = await api<AttendantState>("/attendant");
    if (index === generation.current) setState(snapshot);
  }, []);
  useEffect(() => {
    void load().catch((error) => setError(message(error)));
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void load().catch(() => {});
    }, 10000);
    return () => window.clearInterval(timer);
  }, [load]);
  const configure = useCallback(
    (socket: Socket) => {
      const refresh = () => void load().catch(() => {});
      socket.on("connect", refresh);
      socket.on("ticket.issued", refresh);
      socket.on("ticket.updated", refresh);
      socket.on("queue.stats", refresh);
    },
    [load],
  );
  const online = useRealtime(configure);

  const request = useCallback(
    async (path: string, method: string, body?: unknown) => {
      if (pending.current) return;
      pending.current = true;
      setBusy(true);
      setError("");
      try {
        await api(path, method, body);
        setForward(false);
        await load();
      } catch (error) {
        setError(message(error));
        await load().catch(() => {});
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [load],
  );

  const call = useCallback(
    (code?: string) => {
      void request("/queue/call", "POST", code ? { code } : {});
    },
    [request],
  );
  const update = useCallback(
    (id: string, input: TicketAction) => {
      void request(`/queue/tickets/${id}/action`, "POST", input);
    },
    [request],
  );

  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !state?.session ||
        forward
      )
        return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(
          "input, select, button, textarea, [contenteditable]",
        )
      )
        return;
      if (event.code === "Space" && !state.active) {
        event.preventDefault();
        call();
      }
      if (event.key.toLowerCase() === "r" && state.active?.status === "CALLED")
        update(state.active.id, { action: "RECALL" });
    }
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [call, forward, state, update]);

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void request("/attendant/shift", "POST", {
      counterId: form.get("counter"),
      serviceIds: form.getAll("service"),
    });
  }

  function submitForward(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (state?.active)
      update(state.active.id, {
        action: "FORWARD",
        serviceId: String(form.get("service")),
        counterId: String(form.get("counter")) || undefined,
      });
  }

  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <p className="eyebrow">{actor.tenantName}</p>
          <h1>Posto de atendimento</h1>
          <p>
            {state?.session
              ? state.session.counterName
              : "Selecione o guichê para iniciar seu turno."}
          </p>
        </div>
        <span className={`pill ${online ? "" : "inactive"}`} role="status">
          {online ? "Conectado" : "Reconectando…"}
        </span>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!state && !error && <p role="status">Carregando filas…</p>}
      {state && !state.session && (
        <section className="surface">
          <div className="section-head">
            <h2>Iniciar turno</h2>
          </div>
          <form className="editor" onSubmit={start}>
            <label>
              Guichê
              <select required name="counter" defaultValue="">
                <option value="" disabled>
                  Selecione um guichê
                </option>
                {state.counters.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Serviços atendidos</legend>
              <div className="check-grid">
                {state.services.map(({ id, name }) => (
                  <label key={id} className="checkbox">
                    <input type="checkbox" name="service" value={id} />
                    {name}
                  </label>
                ))}
              </div>
            </fieldset>
            {!state.counters.length || !state.services.length ? (
              <p>Cadastre guichês e serviços na administração para começar.</p>
            ) : (
              <div>
                <button className="primary" disabled={busy}>
                  Iniciar turno
                </button>
              </div>
            )}
          </form>
        </section>
      )}
      {state?.session && (
        <>
          <div className="attendant-grid">
            <section className="surface current-ticket">
              <div className="section-head">
                <h2>Senha atual</h2>
                <button
                  disabled={busy || Boolean(state.active)}
                  onClick={() => void request("/attendant/shift", "DELETE")}
                >
                  Encerrar turno
                </button>
              </div>
              <div className="current-body">
                {state.active ? (
                  <>
                    <p className="eyebrow">
                      {ticketStatusLabels[state.active.status]}
                    </p>
                    <strong className="current-code">
                      {state.active.code}
                    </strong>
                    {state.active.displayName && (
                      <p>{state.active.displayName}</p>
                    )}
                    <p>{priorityLabels[state.active.priority]}</p>
                  </>
                ) : (
                  <>
                    <h3>Nenhuma senha em atendimento</h3>
                    <p>Chame uma pessoa para o guichê.</p>
                  </>
                )}
              </div>
              <div className="editor">
                {state.active ? (
                  state.active.status === "CALLED" ? (
                    <div className="actions">
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          update(state.active!.id, { action: "START" })
                        }
                      >
                        Iniciar atendimento
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          update(state.active!.id, { action: "RECALL" })
                        }
                      >
                        Rechamar <kbd>R</kbd>
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          update(state.active!.id, { action: "NO_SHOW" })
                        }
                      >
                        Não compareceu
                      </button>
                    </div>
                  ) : (
                    <div className="actions">
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          update(state.active!.id, { action: "FINISH" })
                        }
                      >
                        Finalizar
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => setForward(!forward)}
                      >
                        Encaminhar
                      </button>
                    </div>
                  )
                ) : (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => call()}
                  >
                    Chamar próximo <kbd>Espaço</kbd>
                  </button>
                )}
                {forward && state.active && (
                  <form className="forward" onSubmit={submitForward}>
                    <label>
                      Serviço de destino
                      <select name="service" required defaultValue="">
                        <option value="" disabled>
                          Selecione o serviço
                        </option>
                        {state.services
                          .filter(({ id }) => id !== state.active?.serviceId)
                          .map(({ id, name }) => (
                            <option key={id} value={id}>
                              {name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Guichê de destino
                      <select name="counter" defaultValue="">
                        <option value="">Qualquer guichê</option>
                        {state.counters.map(({ id, name }) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="primary" disabled={busy}>
                      Confirmar encaminhamento
                    </button>
                  </form>
                )}
              </div>
            </section>
            <section className="surface">
              <div className="section-head">
                <h2>Filas do guichê</h2>
              </div>
              <ul className="records">
                {state.stats.map(({ serviceId, name, waiting, oldest }) => (
                  <li key={serviceId}>
                    <div>
                      <strong>{name}</strong>
                      <p>Maior espera {waitTime(oldest, now)}</p>
                    </div>
                    <span className="pill">{waiting} aguardando</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <section className="surface">
            <div className="section-head">
              <h2>Senhas aguardando</h2>
              <form
                className="actions"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  call(String(data.get("code")));
                }}
              >
                <input
                  className="code-input"
                  name="code"
                  aria-label="Código da senha"
                  placeholder="Ex. R001"
                  required
                />
                <button disabled={busy || Boolean(state.active)}>
                  Chamar senha específica
                </button>
              </form>
            </div>
            {state.waiting.length ? (
              <ul className="records">
                {state.waiting.map((ticket) => (
                  <li key={ticket.id}>
                    <div>
                      <strong>{ticket.code}</strong>
                      <p>
                        {
                          state.stats.find(
                            ({ serviceId }) => serviceId === ticket.serviceId,
                          )?.name
                        }{" "}
                        · {priorityLabels[ticket.priority]}
                      </p>
                    </div>
                    <div className="actions">
                      <button
                        disabled={busy || Boolean(state.active)}
                        onClick={() => call(ticket.code)}
                      >
                        Chamar
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(`Cancelar a senha ${ticket.code}?`)
                          )
                            update(ticket.id, { action: "CANCEL" });
                        }}
                      >
                        Cancelar senha
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">O guichê está sem senhas aguardando.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
