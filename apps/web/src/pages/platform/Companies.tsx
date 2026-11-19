import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { PlatformCompany } from "@beend/shared";
import { api, message } from "../../api";
import { CompanyAccess } from "./CompanyAccess";

type InitialAccess = { company: string; email: string; password: string };

function limitLabel(used: number, limit: number | null) {
  return limit === null ? `${used} · sem limite` : `${used} de ${limit}`;
}

function contract(form: FormData) {
  const numericLimit = (name: string) => {
    const value = String(form.get(name) ?? "").trim();
    return value === "" ? null : Number(value);
  };
  return {
    name: String(form.get("name")),
    planName: String(form.get("planName") ?? "").trim() || null,
    kioskLimit: numericLimit("kioskLimit"),
    panelLimit: numericLimit("panelLimit"),
  };
}

function ContractFields({ company }: { company?: PlatformCompany }) {
  return (
    <div className="form-grid">
      <label>
        Nome da empresa
        <input
          name="name"
          maxLength={100}
          required
          defaultValue={company?.name}
        />
      </label>
      <label>
        Plano comercial
        <input
          name="planName"
          maxLength={60}
          defaultValue={company ? (company.planName ?? "") : "Essencial"}
        />
      </label>
      <label>
        Limite de totens
        <input
          name="kioskLimit"
          type="number"
          min={0}
          max={10000}
          placeholder="Sem limite"
          defaultValue={company ? (company.kioskLimit ?? "") : 1}
        />
      </label>
      <label>
        Limite de TVs
        <input
          name="panelLimit"
          type="number"
          min={0}
          max={10000}
          placeholder="Sem limite"
          defaultValue={company ? (company.panelLimit ?? "") : 1}
        />
      </label>
    </div>
  );
}

function temporaryPassword() {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function Companies() {
  const [companies, setCompanies] = useState<PlatformCompany[]>();
  const [editor, setEditor] = useState<PlatformCompany | "new">();
  const [access, setAccess] = useState<InitialAccess>();
  const [recovery, setRecovery] = useState<PlatformCompany>();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(
    async () => setCompanies(await api<PlatformCompany[]>("/admin/tenants")),
    [],
  );
  useEffect(() => {
    void load().catch((error) => setError(message(error)));
  }, [load]);

  async function act(work: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await work();
      setEditor(undefined);
      setStatus(success);
      await load();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (editor === "new") {
      const email = String(form.get("email")).trim().toLowerCase();
      const password = temporaryPassword();
      void act(async () => {
        const created = await api<PlatformCompany>("/admin/tenants", "POST", {
          ...contract(form),
          slug: form.get("slug"),
          unitName: form.get("unitName"),
          adminName: form.get("adminName"),
          email,
          password,
        });
        setAccess({ company: created.slug, email, password });
      }, "Empresa cadastrada.");
    } else if (editor) {
      void act(async () => {
        await api(`/admin/tenants/${editor.id}`, "PUT", {
          ...contract(form),
          active: editor.active,
        });
      }, "Empresa atualizada.");
    }
  }

  function resetAccess(email: string) {
    if (
      !recovery ||
      !window.confirm(
        "Gerar uma nova senha inicial e encerrar as sessões desse administrador?",
      )
    )
      return;
    const password = temporaryPassword();
    void act(async () => {
      await api(`/admin/tenants/${recovery.id}/admin-password`, "POST", {
        email,
        password,
      });
      setRecovery(undefined);
      setAccess({ company: recovery.slug, email, password });
    }, "Nova senha inicial gerada.");
  }

  function toggle(company: PlatformCompany) {
    const active = !company.active;
    if (
      !active &&
      !window.confirm(
        `Suspender o acesso de ${company.name}? As filas, os totens e os painéis ficarão indisponíveis até a reativação.`,
      )
    )
      return;
    const { name, planName, kioskLimit, panelLimit, id } = company;
    void act(
      async () => {
        await api(`/admin/tenants/${id}`, "PUT", {
          name,
          planName,
          kioskLimit,
          panelLimit,
          active,
        });
      },
      active ? "Empresa reativada." : "Empresa suspensa.",
    );
  }

  const login = access
    ? new URL(
        `/entrar?empresa=${encodeURIComponent(access.company)}`,
        window.location.origin,
      ).href
    : "";
  async function copyAccess() {
    if (!access) return;
    const text = [
      `Acesso ao Beend Fila: ${login}`,
      `Empresa: ${access.company}`,
      `E-mail: ${access.email}`,
      `Senha inicial: ${access.password}`,
      "No primeiro acesso, escolha uma nova senha.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Dados de acesso copiados.");
    } catch {
      setError("Copie os dados de acesso exibidos na tela.");
    }
  }

  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const filtered =
    companies?.filter(({ name, slug, planName }) =>
      [name, slug, planName ?? ""].some((field) =>
        field.toLocaleLowerCase("pt-BR").includes(normalized),
      ),
    ) ?? [];
  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <p className="eyebrow">Plataforma Beend</p>
          <h1>Empresas</h1>
          <p>Cadastre clientes e gerencie seus planos, limites e acesso.</p>
        </div>
        <button className="primary" onClick={() => setEditor("new")}>
          Cadastrar empresa
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="confirmation" role="status">
          {status}
        </p>
      )}
      {access && (
        <section className="surface">
          <div className="section-head">
            <div>
              <h2>Acesso inicial</h2>
              <p>
                Compartilhe estes dados com o administrador do cliente. Ele vai
                escolher uma nova senha no primeiro acesso.
              </p>
            </div>
            <button onClick={() => setAccess(undefined)}>
              Fechar dados de acesso
            </button>
          </div>
          <div className="editor">
            <dl className="platform-access">
              <div>
                <dt>Endereço</dt>
                <dd>
                  <a href={login} target="_blank" rel="noreferrer">
                    {login}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Empresa</dt>
                <dd>{access.company}</dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd>{access.email}</dd>
              </div>
              <div>
                <dt>Senha inicial</dt>
                <dd>
                  <code>{access.password}</code>
                </dd>
              </div>
            </dl>
            <div>
              <button onClick={() => void copyAccess()}>
                Copiar dados de acesso
              </button>
            </div>
          </div>
        </section>
      )}
      {recovery && (
        <CompanyAccess
          key={recovery.id}
          company={recovery}
          busy={busy}
          onClose={() => setRecovery(undefined)}
          onReset={resetAccess}
        />
      )}
      {editor && (
        <section className="surface">
          <div className="section-head">
            <h2>
              {editor === "new" ? "Nova empresa" : `Editar ${editor.name}`}
            </h2>
          </div>
          <form
            className="editor"
            key={editor === "new" ? "new" : editor.id}
            onSubmit={submit}
          >
            <ContractFields company={editor === "new" ? undefined : editor} />
            <p>
              Deixe um limite vazio para liberar cadastros sem limite. Use zero
              para bloquear esse tipo de dispositivo.
            </p>
            {editor === "new" && (
              <div className="form-grid">
                <label>
                  Identificador da empresa
                  <input
                    name="slug"
                    maxLength={60}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    placeholder="ex. clinica-central"
                    required
                  />
                </label>
                <label>
                  Nome da unidade
                  <input
                    name="unitName"
                    maxLength={100}
                    defaultValue="Unidade principal"
                    required
                  />
                </label>
                <label>
                  Nome do administrador
                  <input name="adminName" maxLength={100} required />
                </label>
                <label>
                  E-mail do administrador
                  <input name="email" type="email" maxLength={160} required />
                </label>
              </div>
            )}
            <div className="actions">
              <button type="button" onClick={() => setEditor(undefined)}>
                Cancelar
              </button>
              <button className="primary" disabled={busy}>
                {editor === "new" ? "Criar empresa" : "Salvar alterações"}
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="surface">
        <div className="section-head">
          <div>
            <h2>Empresas cadastradas</h2>
            {companies && (
              <p>
                {companies.filter(({ active }) => active).length} de{" "}
                {companies.length} com acesso ativo
              </p>
            )}
          </div>
          <label>
            Buscar empresa
            <input
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Nome ou identificador"
            />
          </label>
        </div>
        {!companies ? (
          <p className="empty">Carregando empresas…</p>
        ) : filtered.length ? (
          <ul className="records">
            {filtered.map((company) => (
              <li key={company.id}>
                <div>
                  <strong>{company.name}</strong>
                  <p>
                    {company.slug} · {company.planName ?? "Sem plano definido"}
                  </p>
                  <p>
                    Totens{" "}
                    {limitLabel(
                      company.deviceUsage.KIOSK.used,
                      company.kioskLimit,
                    )}{" "}
                    · TVs{" "}
                    {limitLabel(
                      company.deviceUsage.PANEL.used,
                      company.panelLimit,
                    )}
                  </p>
                </div>
                <span className={`pill${company.active ? "" : " inactive"}`}>
                  {company.active ? "Ativa" : "Suspensa"}
                </span>
                <div className="actions">
                  <button disabled={busy} onClick={() => setEditor(company)}>
                    Editar plano e limites
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setEditor(undefined);
                      setRecovery(company);
                    }}
                  >
                    Ver acessos
                  </button>

                  <button disabled={busy} onClick={() => toggle(company)}>
                    {company.active ? "Suspender" : "Reativar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nenhuma empresa encontrada.</p>
        )}
      </section>
    </main>
  );
}
