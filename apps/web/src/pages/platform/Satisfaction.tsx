import { useEffect, useState } from "react";
import type { NpsReport } from "@beend/shared";
import { api, message } from "../../api";

const periods = [
  { days: 30, label: "Últimos 30 dias" },
  { days: 90, label: "Últimos 90 dias" },
  { days: 365, label: "Últimos 12 meses" },
] as const;
const roles = { ADMIN: "Administrador", ATTENDANT: "Atendente" } as const;
const tone = (score: number) =>
  score <= 6 ? "detractor" : score <= 8 ? "passive" : "promoter";

function percent(part: number, total: number) {
  return total ? `${Math.round((part / total) * 100)}%` : "—";
}

export function Satisfaction() {
  const [days, setDays] = useState<number>(90);
  const [report, setReport] = useState<NpsReport>();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    void api<NpsReport>(`/admin/nps?days=${days}`).then(
      (report) => {
        if (active) setReport(report);
      },
      (error) => {
        if (active) setError(message(error));
      },
    );
    return () => {
      active = false;
    };
  }, [days]);

  const score = report?.score;
  const scoreTone =
    score === null || score === undefined
      ? ""
      : score >= 50
        ? "promoter"
        : score >= 0
          ? "passive"
          : "detractor";
  const cards = report
    ? [
        {
          label: "Respostas",
          value: String(report.total),
          note: periods.find((period) => period.days === days)?.label,
          tone: "neutral",
        },
        {
          label: "Promotores",
          value: String(report.promoters),
          note: `${percent(report.promoters, report.total)} · notas 9 e 10`,
          tone: "promoter",
        },
        {
          label: "Neutros",
          value: String(report.passives),
          note: `${percent(report.passives, report.total)} · notas 7 e 8`,
          tone: "passive",
        },
        {
          label: "Detratores",
          value: String(report.detractors),
          note: `${percent(report.detractors, report.total)} · notas 0 a 6`,
          tone: "detractor",
        },
      ]
    : [];

  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <p className="eyebrow">Uso interno da Beend</p>
          <h1>Satisfação dos clientes</h1>
          <p>
            Notas que administradores e atendentes deram ao Beend Fila. Cada
            pessoa pode responder uma vez a cada 30 dias.
          </p>
        </div>
        <label>
          Período
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            {periods.map((period) => (
              <option key={period.days} value={period.days}>
                {period.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!report && !error && <p role="status">Carregando resultados…</p>}
      {report && (
        <>
          <section className="nps-overview" aria-label="Resumo do NPS">
            <article className={`metric-card nps-score-card ${scoreTone}`}>
              <span className="metric-label">NPS</span>
              <strong className="metric-value">
                {score === null ? "—" : score}
              </strong>
              <span className="metric-note">
                {score === null
                  ? "Ainda sem respostas no período"
                  : "% de promotores menos % de detratores"}
              </span>
            </article>
            {cards.map((card) => (
              <article key={card.label} className={`metric-card ${card.tone}`}>
                <span className="metric-label">{card.label}</span>
                <strong className="metric-value">{card.value}</strong>
                <span className="metric-note">{card.note}</span>
              </article>
            ))}
          </section>
          <section className="surface" aria-labelledby="nps-responses">
            <div className="section-head">
              <h2 id="nps-responses">Respostas</h2>
            </div>
            {report.responses.length ? (
              <div className="report-table">
                <table className="nps-table">
                  <thead>
                    <tr>
                      <th scope="col">Data</th>
                      <th scope="col">Empresa</th>
                      <th scope="col">Perfil</th>
                      <th scope="col">Nota</th>
                      <th scope="col">Comentário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.responses.map((response) => (
                      <tr key={response.id}>
                        <td>
                          {new Date(response.createdAt).toLocaleDateString(
                            "pt-BR",
                            { timeZone: "America/Sao_Paulo" },
                          )}
                        </td>
                        <td>{response.companyName}</td>
                        <td>{roles[response.role]}</td>
                        <td>
                          <span className={`nps-badge ${tone(response.score)}`}>
                            {response.score}
                          </span>
                        </td>
                        <td>{response.comment ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">Nenhuma resposta no período.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
