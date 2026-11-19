import { Icon } from "../../components/Icon";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  dayStartUtc,
  nextDay,
  type Actor,
  type ManagedCard,
} from "@beend/shared";
import { api, message } from "../../api";

type ContentData = { logoUrl: string | null; cards: ManagedCard[] };
const labels = { TIP: "Curiosidade / dica", NOTICE: "Aviso / anúncio" };

async function upload(file: FormDataEntryValue | null, format?: "png") {
  if (!(file instanceof File) || !file.size) return undefined;
  const body = new FormData();
  body.set("file", file);
  return (
    await api<{ imageUrl: string }>(
      format ? `/admin/assets?format=${format}` : "/admin/assets",
      "POST",
      body,
    )
  ).imageUrl;
}

function dateValue(iso: string | null | undefined, timeZone: string) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function Content({ actor }: { actor: Actor }) {
  const [data, setData] = useState<ContentData>();
  const [editor, setEditor] = useState<ManagedCard | "new">();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    async () => setData(await api<ContentData>("/admin/content")),
    [],
  );
  useEffect(() => {
    void load().catch((error) => setError(message(error)));
  }, [load]);

  async function action(work: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await work();
      setEditor(undefined);
      await load();
      setStatus(success);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  function submitCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const card = editor === "new" ? undefined : editor;
    void action(async () => {
      const image = await upload(form.get("file"));
      await api(
        card ? `/admin/cards/${card.id}` : "/admin/cards",
        card ? "PUT" : "POST",
        {
          type: form.get("type"),
          title: form.get("title"),
          text: form.get("text"),
          imageUrl:
            image ?? (form.has("remove") ? null : (card?.imageUrl ?? null)),
          validFrom: form.get("validFrom")
            ? dayStartUtc(
                String(form.get("validFrom")),
                actor.timeZone,
              ).toISOString()
            : null,
          validTo: form.get("validTo")
            ? new Date(
                dayStartUtc(
                  nextDay(String(form.get("validTo"))),
                  actor.timeZone,
                ).getTime() - 1,
              ).toISOString()
            : null,
          active: form.has("active"),
          global: card ? card.global : form.has("global"),
        },
      );
    }, "Conteúdo salvo.");
  }

  function logo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action(async () => {
      const imageUrl = await upload(form.get("file"), "png");
      if (imageUrl) await api("/admin/logo", "PUT", { imageUrl });
    }, "Logotipo salvo.");
  }

  const card = editor === "new" ? undefined : editor;
  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <h1>Conteúdo do painel</h1>
          <p>Gerencie avisos, dicas e o logotipo exibidos na TV.</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="confirmation">
          {status}
        </p>
      )}
      <section className="surface">
        <div className="section-head">
          <h2>Logotipo da TV</h2>
          {data?.logoUrl && (
            <img
              className="content-logo"
              src={data.logoUrl}
              alt="Logotipo atual"
            />
          )}
        </div>
        <form className="editor" onSubmit={logo}>
          <p>Para o fundo escuro da TV, use uma versão clara da marca.</p>
          <label>
            Imagem do logotipo
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <div className="actions">
            <button className="primary" disabled={busy}>
              <Icon name="check" /> Salvar logotipo
            </button>
            {data?.logoUrl && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void action(
                    () => api("/admin/logo", "PUT", { imageUrl: null }),
                    "Logotipo removido.",
                  )
                }
              >
                Remover logotipo
              </button>
            )}
          </div>
        </form>
      </section>
      <section className="surface">
        <div className="section-head">
          <h2>Avisos e dicas</h2>
          <button className="primary" onClick={() => setEditor("new")}>
            <Icon name="plus" /> Adicionar conteúdo
          </button>
        </div>
        {editor && (
          <form
            className="editor"
            key={card?.id ?? "new"}
            onSubmit={submitCard}
          >
            <h3>{card ? "Editar conteúdo" : "Novo conteúdo"}</h3>
            <div className="form-grid">
              <label>
                Tipo
                <select name="type" defaultValue={card?.type ?? "NOTICE"}>
                  <option value="NOTICE">{labels.NOTICE}</option>
                  <option value="TIP">{labels.TIP}</option>
                </select>
              </label>
              <label>
                Título
                <input
                  name="title"
                  maxLength={130}
                  defaultValue={card?.title}
                  required
                />
              </label>
              <label>
                Início da exibição
                <input
                  name="validFrom"
                  type="date"
                  defaultValue={dateValue(card?.validFrom, actor.timeZone)}
                />
              </label>
              <label>
                Fim da exibição
                <input
                  name="validTo"
                  type="date"
                  defaultValue={dateValue(card?.validTo, actor.timeZone)}
                />
              </label>
            </div>
            <label>
              Texto
              <textarea
                name="text"
                maxLength={300}
                rows={3}
                defaultValue={card?.text}
              />
            </label>
            <label>
              Imagem
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
            </label>
            {card?.imageUrl && (
              <label className="checkbox">
                <input type="checkbox" name="remove" />
                Remover imagem atual
              </label>
            )}
            <label className="checkbox">
              <input
                type="checkbox"
                name="active"
                defaultChecked={card?.active ?? true}
              />
              Ativo
            </label>
            {!card && actor.role === "SUPERADMIN" && (
              <label className="checkbox">
                <input type="checkbox" name="global" />
                Dica global da Beend
              </label>
            )}
            <div className="actions">
              <button type="button" onClick={() => setEditor(undefined)}>
                Cancelar
              </button>
              <button className="primary" disabled={busy}>
                <Icon name="check" /> Salvar conteúdo
              </button>
            </div>
          </form>
        )}
        {data?.cards.length ? (
          <ul className="records">
            {data.cards.map((item) => (
              <li key={item.id}>
                {item.imageUrl && (
                  <img className="content-thumb" src={item.imageUrl} alt="" />
                )}
                <div className="record-title">
                  <strong>{item.title}</strong>
                  <p>
                    {labels[item.type]}
                    {item.global ? " · Global" : ""}
                    {item.active ? "" : " · Inativo"}
                  </p>
                </div>
                <div className="actions">
                  <button onClick={() => setEditor(item)}>Editar</button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Remover “${item.title}”?`))
                        void action(
                          () =>
                            api(
                              `/admin/cards/${item.id}?global=${item.global}`,
                              "DELETE",
                            ),
                          "Conteúdo removido.",
                        );
                    }}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">
            {data ? "Nenhum conteúdo cadastrado." : "Carregando conteúdos…"}
          </p>
        )}
      </section>
    </main>
  );
}
