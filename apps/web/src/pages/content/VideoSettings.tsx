import { useState, type FormEvent } from "react";
import type { PanelEditorData, PanelSceneId } from "@beend/shared";
import { Icon } from "../../components/Icon";
import { api, message } from "../../api";

export function VideoSettings({
  panelId,
  data,
}: {
  panelId: string;
  data: PanelEditorData;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [sceneIds, setSceneIds] = useState(data.config.sceneIds);

  function reorder(index: number, nextIndex: number) {
    setSaved(false);
    setSceneIds((previous) => {
      const next = [...previous];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  }

  function toggle(id: PanelSceneId, selected: boolean) {
    setSceneIds((previous) =>
      selected ? [...previous, id] : previous.filter((scene) => scene !== id),
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await api(`/admin/panels/${panelId}/videos`, "PATCH", {
        sceneIds,
        sceneFrequency: form.get("sceneFrequency"),
      });
      setSaved(true);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface" aria-labelledby="tv-videos">
      <div className="section-head">
        <h2 id="tv-videos">Vídeos da TV</h2>
      </div>
      <form
        className="editor"
        onSubmit={(event) => void save(event)}
        onChange={() => setSaved(false)}
      >
        <p>
          Marque as cenas que entram no carrossel. Para desativar os vídeos,
          deixe todas desmarcadas.
        </p>
        <fieldset disabled={busy}>
          <legend>Cenas do Wikimedia Commons</legend>
          <div className="form-grid">
            {data.videoCatalog.map((scene) => (
              <div key={scene.id}>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={sceneIds.includes(scene.id)}
                    onChange={(event) => toggle(scene.id, event.target.checked)}
                  />
                  {scene.label}
                </label>
                <p>
                  {scene.seconds} s · {scene.title}
                </p>
                <a href={scene.sourceUrl} target="_blank" rel="noreferrer">
                  Ver ficha do vídeo
                </a>
              </div>
            ))}
          </div>
        </fieldset>
        {sceneIds.length > 1 && (
          <fieldset disabled={busy}>
            <legend>Ordem de exibição</legend>
            <ol className="video-order">
              {sceneIds.map((id, index) => {
                const label = data.videoCatalog.find(
                  (scene) => scene.id === id,
                )?.label;
                return (
                  <li key={id}>
                    <div className="actions">
                      <span>{label}</span>
                      <button
                        type="button"
                        aria-label={`Subir ${label}`}
                        disabled={index === 0}
                        onClick={() => reorder(index, index - 1)}
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        aria-label={`Descer ${label}`}
                        disabled={index === sceneIds.length - 1}
                        onClick={() => reorder(index, index + 1)}
                      >
                        Descer
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </fieldset>
        )}
        <label>
          Cartões entre vídeos
          <input
            name="sceneFrequency"
            type="number"
            min={1}
            max={10}
            defaultValue={data.config.sceneFrequency}
            required
            disabled={busy}
          />
        </label>
        <div>
          <button className="primary" disabled={busy}>
            <Icon name="check" /> Salvar vídeos
          </button>
        </div>
        {saved && (
          <p className="confirmation" role="status">
            Programação de vídeos salva.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
