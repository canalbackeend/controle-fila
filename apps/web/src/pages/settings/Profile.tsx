import { useState, type FormEvent } from "react";
import type { Actor, TenantTheme } from "@beend/shared";
import { ProfileDeviceLinks } from "./ProfileDeviceLinks";
import { ThemeEditor } from "./ThemeEditor";
import { api, message } from "../../api";

const roles = {
  ADMIN: "Administrador",
  SUPERADMIN: "Superadministrador",
  ATTENDANT: "Atendente",
};

export function Profile({
  actor,
  onSave,
  onThemeSave,
}: {
  actor: Actor;
  onSave: (actor: Actor) => void;
  onThemeSave: (theme: TenantTheme | null) => void;
}) {
  const [name, setName] = useState(actor.name);
  const [email, setEmail] = useState(actor.email);
  const [changePassword, setChangePassword] = useState(
    actor.mustChangePassword,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const needsPassword =
    changePassword || email.trim().toLowerCase() !== actor.email;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    const form = new FormData(event.currentTarget);
    const newPassword = changePassword
      ? String(form.get("newPassword"))
      : undefined;
    if (newPassword && newPassword !== form.get("confirmPassword")) {
      setError("As senhas novas precisam ser iguais.");
      return;
    }
    setBusy(true);
    try {
      const updated = await api<Actor>("/auth/profile", "PUT", {
        name,
        email,
        currentPassword: needsPassword
          ? form.get("currentPassword")
          : undefined,
        newPassword,
      });
      onSave(updated);
      setName(updated.name);
      setEmail(updated.email);
      setChangePassword(false);
      setSaved(true);
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
          <h1>Meu perfil</h1>
          <p>Gerencie os dados da sua conta em {actor.tenantName}.</p>
        </div>
      </div>
      {actor.mustChangePassword ? (
        <p className="confirmation" role="status">
          Troque a senha inicial para liberar o acesso à sua empresa.
        </p>
      ) : (
        <ProfileDeviceLinks />
      )}
      <section className="surface">
        <div className="section-head">
          <h2>Dados da conta</h2>
          <span className="pill inactive">{roles[actor.role]}</span>
        </div>
        <form className="editor" onSubmit={(event) => void save(event)}>
          <div className="form-grid">
            <label>
              Nome
              <input
                value={name}
                onChange={(event) => {
                  setName(event.currentTarget.value);
                  setSaved(false);
                }}
                required
                maxLength={100}
                autoComplete="name"
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.currentTarget.value);
                  setSaved(false);
                }}
                required
                maxLength={160}
                autoComplete="email"
              />
            </label>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={changePassword}
              disabled={actor.mustChangePassword}
              onChange={(event) => {
                setChangePassword(event.currentTarget.checked);
                setSaved(false);
              }}
            />{" "}
            Alterar senha
          </label>
          {needsPassword && (
            <div className="form-grid">
              <label>
                Senha atual
                <input
                  type="password"
                  name="currentPassword"
                  autoComplete="current-password"
                  required
                />
              </label>
              {changePassword && (
                <>
                  <label>
                    Nova senha
                    <input
                      type="password"
                      name="newPassword"
                      autoComplete="new-password"
                      minLength={12}
                      required
                    />
                  </label>
                  <label>
                    Confirme a nova senha
                    <input
                      type="password"
                      name="confirmPassword"
                      autoComplete="new-password"
                      minLength={12}
                      required
                    />
                  </label>
                </>
              )}
            </div>
          )}
          {changePassword && (
            <p>
              Use pelo menos 12 caracteres. A alteração encerra as outras
              sessões da conta.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="confirmation" role="status">
              Perfil salvo.
            </p>
          )}
          <div>
            <button className="primary" disabled={busy}>
              {busy ? "Salvando…" : "Salvar perfil"}
            </button>
          </div>
        </form>
      </section>
      {!actor.mustChangePassword && (
        <ThemeEditor
          current={actor.personalTheme ?? null}
          inherited={actor.theme}
          onSave={async (theme) => {
            const saved = await api<{ theme: TenantTheme | null }>(
              "/auth/profile/theme",
              "PUT",
              { theme },
            );
            onThemeSave(saved.theme);
          }}
        />
      )}
    </main>
  );
}
