import { BrandLogo } from "../../components/BrandLogo";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { Actor } from "@beend/shared";
import { api, message } from "../../api";

export function Login({ onLogin }: { onLogin: (actor: Actor) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setError("");
    setBusy(true);
    try {
      const actor = await api<Actor>("/auth/login", "POST", fields);
      onLogin(actor);
      navigate(actor.role === "ATTENDANT" ? "/atendente" : "/admin", {
        replace: true,
      });
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section className="login-aside">
        <BrandLogo onDark />
        <div className="login-pitch">
          <h1>
            Atendimento
            <br />
            em ordem.
          </h1>
          <p>Gerencie filas, guichês e equipes em um só lugar.</p>
        </div>
      </section>
      <section className="login-main">
        <div className="login-form">
          <h2>Acesse sua conta</h2>
          <p>Entre com os dados da sua empresa.</p>
          <form onSubmit={(event) => void submit(event)}>
            <label>
              Identificador da empresa
              <input
                name="tenant"
                required
                autoComplete="organization"
                placeholder="ex. demo"
              />
            </label>
            <label>
              E-mail
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="voce@empresa.com.br"
              />
            </label>
            <label>
              Senha
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
