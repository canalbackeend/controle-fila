import { useState, useRef, type FormEvent } from "react";
import {
  priorityLabels,
  type IssuedTicket,
  type ServiceOption,
} from "@beend/shared";
import { ApiError, api, message } from "../api";
import { Receipt } from "./Receipt";

export function IssueAtDesk({ services }: { services: ServiceOption[] }) {
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState("");
  const [ticket, setTicket] = useState<IssuedTicket>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (!fields.customerName) delete fields.customerName;
    const fingerprint = JSON.stringify(fields);
    if (request.current?.fingerprint !== fingerprint)
      request.current = { fingerprint, id: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      setTicket(
        await api<IssuedTicket>("/queue/tickets", "POST", {
          ...fields,
          requestId: request.current.id,
        }),
      );
      request.current = null;
    } catch (error) {
      if (error instanceof ApiError && error.status < 500)
        request.current = null;
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  if (ticket)
    return (
      <Receipt
        ticket={ticket}
        close={() => {
          setTicket(undefined);
          setShow(false);
        }}
      />
    );
  return (
    <section className="surface">
      <div className="section-head">
        <h2>Emissão no balcão</h2>
        <button className="primary" onClick={() => setShow(!show)}>
          {show ? "Fechar emissão" : "Emitir senha"}
        </button>
      </div>
      {show && (
        <form className="editor" onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <label>
              Serviço
              <select
                name="serviceId"
                required
                value={selected}
                onChange={(event) => setSelected(event.currentTarget.value)}
              >
                <option value="" disabled>
                  Selecione o serviço
                </option>
                {services.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select name="priority" required>
                {Object.entries(priorityLabels).map(([priority, label]) => (
                  <option key={priority} value={priority}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {services.find(({ id }) => id === selected)?.callMode ===
              "NAME" && (
              <label>
                Nome do cliente (opcional)
                <input name="customerName" maxLength={100} />
              </label>
            )}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div>
            <button className="primary" disabled={busy}>
              Confirmar emissão
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
