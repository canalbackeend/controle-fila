import { BrandLogo } from "../../components/BrandLogo";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { slugSchema, type Actor, type TenantTheme } from "@beend/shared";
import { themeStyle } from "../../theme";
import { api, message } from "../../api";

export function Login({ onLogin }: { onLogin: (actor: Actor) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const [tenant, setTenant] = useState(query.get("empresa") ?? "");
  const [theme, setTheme] = useState<TenantTheme>();
  useEffect(() => {
    const parsed = slugSchema.safeParse(tenant);
    if (!parsed.success) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void api<TenantTheme>(`/auth/branding/${parsed.data}`).then(
        (theme) => {
          if (active) setTheme(theme);
        },
        () => {
          if (active) setTheme(undefined);
        },
      );
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [tenant]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setError("");
    setBusy(true);
    try {
      const actor = await api<Actor>("/auth/login", "POST", fields);
      onLogin(actor);
      navigate("/", { replace: true });
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login theme" style={themeStyle(theme)}>
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
                value={tenant}
                onChange={(event) => {
                  setTheme(undefined);
                  setTenant(event.currentTarget.value);
                }}
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
