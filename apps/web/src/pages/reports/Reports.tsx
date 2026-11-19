import { Icon } from "../../components/Icon";
import { useEffect, useState, type FormEvent } from "react";
import {
  localDay,
  type Actor,
  type Report,
  type ReportOptions,
} from "@beend/shared";
import { api, message } from "../../api";

const number = new Intl.NumberFormat("pt-BR");
const percent = (value: number) => `${number.format(value)}%`;
function duration(seconds: number) {
  return seconds >= 60
    ? `${Math.floor(seconds / 60)} min ${seconds % 60} s`
    : `${seconds} s`;
}

export function Reports({ actor }: { actor: Actor }) {
  const [options, setOptions] = useState<ReportOptions>();
  const [result, setResult] = useState<Report>();
  const [activeQuery, setActiveQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = localDay(new Date(), actor.timeZone);
  const first = today.slice(0, 7) + "-01";

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ from: first, to: today }).toString();
    void Promise.all([
      api<ReportOptions>("/reports/options"),
      api<Report>(`/reports?${query}`),
    ]).then(
      ([items, report]) => {
        if (active) {
          setOptions(items);
          setResult(report);
          setActiveQuery(query);
        }
      },
      (error) => {
        if (active) setError(message(error));
      },
    );
    return () => {
      active = false;
    };
  }, [first, today]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    for (const [key, value] of form) if (value) query.set(key, String(value));
    setBusy(true);
    setError("");
    try {
      setResult(await api<Report>(`/reports?${query}`));
      setActiveQuery(query.toString());
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <p className="eyebrow">{actor.tenantName}</p>
          <h1>Relatórios</h1>
          <p>Compare o volume e os tempos de atendimento da unidade.</p>
        </div>
        {activeQuery && (
          <a
            className="action-link"
            href={`/api/reports.csv?${activeQuery}`}
            download
          >
            <Icon name="download" /> Exportar CSV
          </a>
        )}
      </div>
      <section className="surface">
        <form className="editor" onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <label>
              Data inicial
              <input name="from" type="date" defaultValue={first} required />
            </label>
            <label>
              Data final
              <input name="to" type="date" defaultValue={today} required />
            </label>
            <label>
              Serviço
              <select name="serviceId">
                <option value="">Todos os serviços</option>
                {options?.services.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Atendente
              <select name="userId">
                <option value="">Todos os atendentes</option>
                {options?.attendants.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <button className="primary" disabled={busy || !options}>
              <Icon name="filter" /> {busy ? "Atualizando…" : "Aplicar filtros"}
            </button>
          </div>
        </form>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <>
          <div className="report-metrics">
            {[
              ["Atendimentos", number.format(result.metrics.completed)],
              ["Espera média", duration(result.metrics.waitSeconds)],
              ["Atendimento médio", duration(result.metrics.serviceSeconds)],
              ["Não comparecimento", percent(result.metrics.noShowRate)],
            ].map(([label, value]) => (
              <section className="surface metric" key={label}>
                <h2>{label}</h2>
                <strong>{value}</strong>
              </section>
            ))}
          </div>
          <section className="surface">
            <div className="section-head">
              <h2>Distribuição por hora</h2>
            </div>
            {result.hours.some(Boolean) ? (
              <div
                className="hour-chart"
                aria-label="Atendimentos e ausências por hora"
              >
                {result.hours.map((count, index) => {
                  const hour = String(index).padStart(2, "0");
                  return (
                    <div
                      className="hour-slot"
                      key={index}
                      title={`${hour}h · ${count} registros`}
                    >
                      <div
                        aria-label={`${hour} horas: ${count} registros`}
                        className="hour-track"
                      >
                        <span
                          style={{
                            height: `${(count / Math.max(...result.hours)) * 100}%`,
                          }}
                        />
                      </div>
                      <span aria-hidden="true">{hour}h</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="empty">Nenhum registro no período selecionado.</p>
            )}
          </section>
          <section className="surface">
            <div className="section-head">
              <h2>Por serviço e atendente</h2>
            </div>
            {result.rows.length ? (
              <div className="report-table">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Serviço",
                        "Atendente",
                        "Atendimentos",
                        "Espera média",
                        "Atendimento médio",
                        "Ausências",
                      ].map((heading) => (
                        <th key={heading} scope="col">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, index) => (
                      <tr key={index}>
                        <td>{row.service}</td>
                        <td>{row.attendant}</td>
                        <td>{row.completed}</td>
                        <td>{duration(row.waitSeconds)}</td>
                        <td>{duration(row.serviceSeconds)}</td>
                        <td>
                          {row.noShows} ({percent(row.noShowRate)})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">
                Nenhum atendimento concluído ou ausência registrada.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
