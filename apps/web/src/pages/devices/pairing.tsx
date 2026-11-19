import { BrandLogo } from "../../components/BrandLogo";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { api, message } from "../../api";
import { FullscreenButton } from "./FullscreenButton";

export function usePairing(id: string) {
  const key = `beend-device:${id}`;
  const [token, setToken] = useState(() => localStorage.getItem(key) ?? "");
  const clear = useCallback(() => {
    localStorage.removeItem(key);
    setToken("");
  }, [key]);
  const auth = useMemo(
    () => (token ? { deviceToken: token } : undefined),
    [token],
  );
  const pair = useCallback(
    async (code: string) => {
      const result = await api<{ token: string }>(
        `/devices/${id}/pair`,
        "POST",
        { code },
      );
      localStorage.setItem(key, result.token);
      setToken(result.token);
    },
    [id, key],
  );
  return { token, auth, clear, pair };
}

export function PairingForm({
  label,
  pair,
}: {
  label: string;
  pair: (code: string) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code"));
    setBusy(true);
    setError("");
    try {
      await pair(code);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="pairing-page">
      <FullscreenButton floating />
      <section className="surface">
        <div className="section-head">
          <BrandLogo />
          <h1>Parear {label}</h1>
        </div>
        <form className="editor" onSubmit={(event) => void submit(event)}>
          <label>
            Código de pareamento
            <input
              autoFocus
              name="code"
              placeholder="empresa.00000000"
              autoComplete="off"
              autoCapitalize="none"
              maxLength={80}
              required
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            Parear dispositivo
          </button>
        </form>
      </section>
    </main>
  );
}
