import { Icon } from "../../components/Icon";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  brazilianStates,
  contentTypes,
  type PanelEditorData,
  type PanelSettings,
} from "@beend/shared";
import { api, message } from "../../api";
import { NewsSettings } from "./NewsSettings";
import { VideoSettings } from "./VideoSettings";

const labels = {
  NOTICE: "Avisos",
  NEWS: "Notícias",
  TIP: "Curiosidades e dicas",
};

export function PanelEditor() {
  const { id } = useParams();
  const [data, setData] = useState<PanelEditorData>();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savingNews, setSavingNews] = useState(false);
  const [newsWeight, setNewsWeight] = useState<string>();
  useEffect(() => {
    void api<PanelEditorData>(`/admin/panels/${id}`).then(setData, (error) =>
      setError(message(error)),
    );
  }, [id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || savingNews) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      await api(`/admin/panels/${id}`, "PUT", {
        serviceIds: form.getAll("serviceId"),
        weights: Object.fromEntries(
          contentTypes.map((type) => [type, form.get(type)]),
        ),
        cardSeconds: form.get("cardSeconds"),
        city: form.get("city"),
        state: form.get("state") || null,
        callDisplaySeconds: form.get("callDisplaySeconds"),
        ticker: form.get("ticker"),
      });
      setSuccess(true);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  function updateNews(config: PanelSettings) {
    setData((previous) => previous && { ...previous, config });
    setNewsWeight(String(config.weights.NEWS));
  }

  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <Link to="/admin/dispositivos">Dispositivos</Link>
          <h1>{data?.name || "Configurar TV e clima"}</h1>
          <p>Defina quais chamadas e conteúdos aparecem na TV.</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="confirmation">
          Configuração salva.
        </p>
      )}
      {data && id && <VideoSettings key={id} panelId={id} data={data} />}
      {data && (
        <section className="surface">
          <form className="editor" onSubmit={(event) => void save(event)}>
            <fieldset>
              <legend>Previsão do tempo</legend>
              <p>
                Defina a localização da TV. Use peso 0 para ocultar a previsão
                no carrossel.
              </p>
              <div className="form-grid">
                <label>
                  Cidade
                  <input
                    name="city"
                    maxLength={100}
                    required
                    defaultValue={data.config.city}
                  />
                </label>
                <label>
                  Estado
                  <select
                    name="state"
                    required
                    defaultValue={data.config.state ?? ""}
                  >
                    <option value="">Selecione o estado</option>
                    {Object.entries(brazilianStates).map(([uf, name]) => (
                      <option key={uf} value={uf}>
                        {name} ({uf})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Peso do clima
                  <input
                    name="WEATHER"
                    type="number"
                    min={0}
                    max={100}
                    required
                    defaultValue={data.config.weights.WEATHER}
                  />
                </label>
              </div>
            </fieldset>
            <NewsSettings
              key={id}
              panelId={id}
              data={data}
              busy={busy || savingNews}
              onSaving={setSavingNews}
              onSaved={updateNews}
            />
            <fieldset>
              <legend>Serviços exibidos</legend>
              <p>Nenhum selecionado exibe todos os serviços.</p>
              <div className="check-grid">
                {data.services.map(({ id, name }) => (
                  <label key={id} className="checkbox">
                    <input
                      name="serviceId"
                      value={id}
                      type="checkbox"
                      defaultChecked={data.config.serviceIds.includes(id)}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Pesos do carrossel</legend>
              <p>Use peso 0 para desativar uma categoria.</p>
              <div className="form-grid">
                {contentTypes
                  .filter((type) => type !== "WEATHER")
                  .map((type) => (
                    <label key={type}>
                      {labels[type]}
                      <input
                        name={type}
                        type="number"
                        min={0}
                        max={100}
                        required
                        {...(type === "NEWS"
                          ? {
                              value:
                                newsWeight ?? String(data.config.weights.NEWS),
                              onChange: (
                                event: ChangeEvent<HTMLInputElement>,
                              ) => setNewsWeight(event.target.value),
                            }
                          : { defaultValue: data.config.weights[type] })}
                      />
                    </label>
                  ))}
              </div>
            </fieldset>
            <div className="form-grid">
              <label>
                Segundos por cartão
                <input
                  name="cardSeconds"
                  type="number"
                  min={5}
                  max={30}
                  required
                  defaultValue={data.config.cardSeconds}
                />
              </label>
              <label>
                Segundos de chamada em destaque
                <input
                  name="callDisplaySeconds"
                  type="number"
                  min={2}
                  max={30}
                  required
                  defaultValue={data.config.callDisplaySeconds}
                />
              </label>
            </div>
            <label>
              Letreiro da TV
              <textarea
                name="ticker"
                maxLength={400}
                rows={3}
                defaultValue={data.config.ticker}
              />
            </label>
            <div>
              <button className="primary" disabled={busy || savingNews}>
                <Icon name="check" /> Salvar painel
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
