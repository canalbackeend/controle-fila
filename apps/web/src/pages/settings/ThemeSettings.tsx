import { useState, type FormEvent } from "react";
import { hexColor, themePresets, type TenantTheme } from "@beend/shared";
import { api, message } from "../../api";
import { themeStyle } from "../../theme";

const presets = Object.entries(themePresets) as [
  keyof typeof themePresets,
  (typeof themePresets)[keyof typeof themePresets],
][];

export function ThemeSettings({
  current,
  onSave,
}: {
  current: TenantTheme;
  onSave: (theme: TenantTheme) => void;
}) {
  const [preset, setPreset] = useState(current.preset);
  const [color, setColor] = useState(
    current.preset === "custom" ? current.color : "#214FB5",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const custom = hexColor.safeParse(color);
  const draft: TenantTheme =
    preset === "custom"
      ? { preset, color: custom.data ?? "#214FB5" }
      : { preset };
  const changed =
    current.preset !== draft.preset ||
    (current.preset === "custom" &&
      draft.preset === "custom" &&
      current.color !== draft.color);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    if (preset === "custom" && !custom.success) {
      setError("Digite uma cor hexadecimal de seis dígitos, como #B22540.");
      return;
    }
    setBusy(true);
    try {
      const theme = await api<TenantTheme>("/admin/theme", "PUT", draft);
      onSave(theme);
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
          <h1>Configurações</h1>
          <p>
            Escolha as cores que identificam sua empresa em todo o Beend Fila.
          </p>
        </div>
      </div>
      <form className="settings-grid" onSubmit={(event) => void save(event)}>
        <section className="surface">
          <div className="section-head">
            <h2>Tema da empresa</h2>
          </div>
          <div className="editor">
            <fieldset>
              <legend>Perfil de cores</legend>
              <div className="theme-preset-list">
                {presets.map(([value, item]) => (
                  <label className="theme-option" key={value}>
                    <input
                      type="radio"
                      name="theme"
                      value={value}
                      checked={preset === value}
                      onChange={() => {
                        setPreset(value);
                        setSaved(false);
                      }}
                    />
                    <span
                      className="theme-swatch"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    <span>{item.name}</span>
                  </label>
                ))}
                <label className="theme-option">
                  <input
                    type="radio"
                    name="theme"
                    value="custom"
                    checked={preset === "custom"}
                    onChange={() => {
                      setPreset("custom");
                      setSaved(false);
                    }}
                  />
                  <span>Personalizado</span>
                </label>
              </div>
            </fieldset>
            {preset === "custom" && (
              <div className="form-grid">
                <label>
                  Seletor de cor
                  <input
                    type="color"
                    value={custom.data ?? "#214FB5"}
                    onChange={(event) => {
                      setColor(event.currentTarget.value);
                      setSaved(false);
                    }}
                  />
                </label>
                <label>
                  Código da cor
                  <input
                    value={color}
                    maxLength={7}
                    onChange={(event) => {
                      setColor(event.currentTarget.value);
                      setSaved(false);
                    }}
                    placeholder="#B22540"
                  />
                </label>
              </div>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {saved && (
              <p className="confirmation" role="status">
                Tema da empresa salvo.
              </p>
            )}
            <div>
              <button
                className="primary"
                disabled={
                  busy || !changed || (preset === "custom" && !custom.success)
                }
              >
                {busy ? "Salvando…" : "Salvar tema"}
              </button>
            </div>
          </div>
        </section>
        <section
          className="surface theme"
          style={themeStyle(draft)}
          aria-label="Prévia do tema"
        >
          <div className="section-head">
            <h2>Prévia</h2>
          </div>
          <div className="theme-preview">
            <div className="theme-preview-light">
              <strong>Telas de atendimento</strong>
              <span className="theme-preview-action">Chamar próximo</span>
            </div>
            <div className="theme-preview-dark">
              <strong>Painel de TV</strong>
              <span>R001</span>
            </div>
          </div>
        </section>
      </form>
    </main>
  );
}
