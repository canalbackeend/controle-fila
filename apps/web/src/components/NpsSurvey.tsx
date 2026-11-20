import { useEffect, useId, useState, type FormEvent } from "react";
import type { Actor, NpsStatus } from "@beend/shared";
import { ApiError, api, message } from "../api";
import { Icon } from "./Icon";

const scores = Array.from({ length: 11 }, (_, score) => score);
const tone = (score: number) =>
  score <= 6 ? "detractor" : score <= 8 ? "passive" : "promoter";

/**
 * Satisfaction survey for client staff. Answers go to the Beend operator only.
 */
export function NpsSurvey({ actor }: { actor: Actor }) {
  const eligible = actor.role !== "SUPERADMIN" && !actor.mustChangePassword;
  const [due, setDue] = useState(false);
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<number>();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const title = useId();

  useEffect(() => {
    if (!eligible) return;
    let active = true;
    void api<NpsStatus>("/nps/status").then(
      ({ due }) => {
        if (active) setDue(due);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [eligible, actor.id]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  useEffect(() => {
    if (!sent) return;
    const timer = window.setTimeout(() => {
      setOpen(false);
      setDue(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [sent]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (score === undefined || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/nps", "POST", { score, comment: comment || undefined });
      setSent(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setSent(true);
      else setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  if (!eligible || !due) return null;
  return (
    <div className="nps">
      {open && (
        <section className="nps-card" role="dialog" aria-labelledby={title}>
          {sent ? (
            <div className="nps-thanks" role="status">
              <span className="nps-thanks-icon">
                <Icon name="checkCircle" />
              </span>
              <h2>Obrigado pelo seu feedback!</h2>
              <p>
                Sua opinião ajuda a beend.tech a evoluir o Beend Fila para a sua
                equipe.
              </p>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)}>
              <header className="nps-head">
                <p className="nps-eyebrow">Pesquisa de satisfação</p>
                <h2 id={title}>
                  De 0 a 10, você recomendaria a{" "}
                  <span className="nps-brand">beend.tech</span> para um amigo ou
                  familiar?
                </h2>
              </header>
              <div className="nps-body">
                <div
                  className="nps-scale"
                  role="group"
                  aria-label="Nota de 0 a 10"
                >
                  {scores.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`nps-score ${tone(value)}`}
                      aria-pressed={score === value}
                      onClick={() => setScore(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="nps-legend" aria-hidden="true">
                  <span>Nada provável</span>
                  <span>Extremamente provável</span>
                </div>
                {score !== undefined && (
                  <label className="nps-comment">
                    Conte o motivo da sua nota (opcional)
                    <textarea
                      value={comment}
                      maxLength={500}
                      rows={3}
                      placeholder="Em que podemos melhorar?"
                      onChange={(event) => setComment(event.target.value)}
                    />
                  </label>
                )}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="nps-send"
                  disabled={score === undefined || busy}
                >
                  <Icon name="send" /> {busy ? "Enviando…" : "Enviar feedback"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
      <button
        type="button"
        className="nps-toggle"
        aria-expanded={open}
        aria-label={
          open
            ? "Fechar pesquisa de satisfação"
            : "Abrir pesquisa de satisfação"
        }
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={open ? "close" : "message"} />
        {!open && <span className="nps-dot" aria-hidden="true" />}
      </button>
    </div>
  );
}
