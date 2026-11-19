import { Icon } from "../../components/Icon";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { contentTypes, type PanelEditorData } from "@beend/shared";
import { api, message } from "../../api";

const labels = {
  NOTICE: "Avisos",
  NEWS: "Notícias",
  WEATHER: "Clima",
  TIP: "Curiosidades e dicas",
};

export function PanelEditor() {
  const { id } = useParams();
  const [data, setData] = useState<PanelEditorData>();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<PanelEditorData>(`/admin/panels/${id}`).then(setData, (error) =>
      setError(message(error)),
    );
  }, [id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      await api(`/admin/panels/${id}`, "PUT", {
        serviceIds: form.getAll("serviceId"),
        newsCategories: form.getAll("category"),
        weights: Object.fromEntries(
          contentTypes.map((type) => [type, form.get(type)]),
        ),
        cardSeconds: form.get("cardSeconds"),
        city: form.get("city"),
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

  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <Link to="/admin/dispositivos">Dispositivos</Link>
          <h1>{data?.name || "Configurar painel"}</h1>
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
      {data && (
        <section className="surface">
          <form className="editor" onSubmit={(event) => void save(event)}>
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
                {contentTypes.map((type) => (
                  <label key={type}>
                    {labels[type]}
                    <input
                      name={type}
                      type="number"
                      min={0}
                      max={100}
                      required
                      defaultValue={data.config.weights[type]}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Categorias de notícias</legend>
              <p>
                Sem seleção, categorias de política e polícia ficam ocultas.
              </p>
              <div className="check-grid">
                {data.categories.map((category) => (
                  <label key={category} className="checkbox">
                    <input
                      name="category"
                      value={category}
                      type="checkbox"
                      defaultChecked={data.config.newsCategories.includes(
                        category,
                      )}
                    />
                    {category}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="form-grid">
              <label>
                Cidade para o clima
                <input
                  name="city"
                  maxLength={100}
                  required
                  defaultValue={data.config.city}
                />
              </label>
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
              <button className="primary" disabled={busy}>
                <Icon name="check" /> Salvar painel
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
