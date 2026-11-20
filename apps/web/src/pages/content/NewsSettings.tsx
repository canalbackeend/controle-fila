import { useState } from "react";
import { Link } from "react-router-dom";
import {
  newsPresets,
  newsTopics,
  type PanelEditorData,
  type PanelNewsSelection,
  type PanelSettings,
} from "@beend/shared";
import { api, message } from "../../api";
import { Icon } from "../../components/Icon";

const topicLabels: Record<string, string> = {
  ...newsTopics,
  geral: "Outras notícias",
};

export function NewsSettings({
  panelId,
  data,
  busy,
  onSaving,
  onSaved,
}: {
  panelId?: string;
  data: PanelEditorData;
  busy: boolean;
  onSaving: (saving: boolean) => void;
  onSaved: (config: PanelSettings) => void;
}) {
  const { config } = data;
  const [selected, setSelected] = useState(config.newsCategories);
  const [feedback, setFeedback] = useState<{ text: string; error?: true }>();
  const categories = [
    ...new Set([...data.categories, ...config.newsCategories]),
  ];

  async function save(selection: PanelNewsSelection) {
    onSaving(true);
    setFeedback(undefined);
    try {
      const updated = await api<PanelSettings>(
        `/admin/panels/${panelId}/news`,
        "PATCH",
        selection,
      );
      onSaved(updated);
      setSelected(updated.newsCategories);
      setFeedback({
        text:
          selection.mode === "AUTO"
            ? "Perfil de notícias aplicado."
            : "Preferências de notícias salvas.",
      });
    } catch (error) {
      setFeedback({ text: message(error), error: true });
    } finally {
      onSaving(false);
    }
  }

  return (
    <fieldset className="news-settings" disabled={busy}>
      <legend>Notícias da TV</legend>
      <p>Escolha um perfil para aplicar na hora.</p>
      <div className="actions">
        {Object.entries(newsPresets).map(([preset, { label, categories }]) => {
          const active =
            config.newsMode === "AUTO" &&
            categories.length === config.newsCategories.length &&
            categories.every((category) =>
              config.newsCategories.includes(category),
            );
          return (
            <button
              key={preset}
              type="button"
              className={active ? "primary" : undefined}
              aria-pressed={active}
              onClick={() =>
                void save({
                  mode: "AUTO",
                  preset: preset as keyof typeof newsPresets,
                })
              }
            >
              {active && <Icon name="check" />} {label}
            </button>
          );
        })}
      </div>
      <details open={config.newsMode === "CUSTOM"}>
        <summary>Configuração manual</summary>
        <p>
          Selecione os temas da TV. Deixe todos desmarcados para exibir apenas
          notícias da sua empresa.
        </p>
        <div className="check-grid">
          {categories.map((category) => (
            <label key={category} className="checkbox">
              <input
                type="checkbox"
                checked={selected.includes(category)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, category]
                      : selected.filter((item) => item !== category),
                  )
                }
              />
              {topicLabels[category] ?? category}
            </label>
          ))}
        </div>
        <div className="actions">
          <button
            type="button"
            onClick={() => void save({ mode: "CUSTOM", categories: selected })}
          >
            <Icon name="check" /> Salvar notícias
          </button>
          <Link to="/admin/conteudo">Cadastrar notícia própria</Link>
        </div>
      </details>
      {feedback && (
        <p
          role={feedback.error ? "alert" : "status"}
          className={feedback.error ? "error" : "confirmation"}
        >
          {feedback.text}
        </p>
      )}
    </fieldset>
  );
}
