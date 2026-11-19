import { Icon } from "../../components/Icon";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Socket } from "socket.io-client";
import {
  ticketStatusLabels,
  type Actor,
  type CounterInput,
  type OpenShift,
  type RecoverShiftInput,
  type ServiceInput,
} from "@beend/shared";
import { ApiError, api, message } from "../../api";
import { useRealtime } from "../../realtime";

type Entity = { id: string; name: string; active?: boolean };
type Service = ServiceInput & Entity;
type Counter = CounterInput & Entity;
type User = Entity & { email: string; role: Actor["role"] };
type Tenant = {
  id: string;
  name: string;
  slug: string;
  timeZone: string;
  resetTime: string;
  retentionDays: number;
};
type AdminData = {
  tenant: Tenant;
  unit: Entity;
  services: Service[];
  counters: Counter[];
  users: User[];
  templates: Entity[];
};
type Collection = "services" | "counters" | "users";
type Field = {
  name: string;
  label: string;
  type?: string;
  choices?: [string, string][];
  value?: string | number;
  optional?: boolean;
  min?: number;
  max?: number;
};

const sections = { services: "Serviços", counters: "Guichês", users: "Equipe" };
const sectionIcons = {
  services: "services",
  counters: "desk",
  users: "team",
} as const;
const singular = { services: "serviço", counters: "guichê", users: "usuário" };
const roles = {
  SUPERADMIN: "Superadministrador",
  ADMIN: "Administrador",
  ATTENDANT: "Atendente",
};
const fields: Record<Collection, Field[]> = {
  services: [
    { name: "name", label: "Nome do serviço" },
    { name: "prefix", label: "Prefixo normal", max: 5 },
    { name: "preferentialPrefix", label: "Prefixo preferencial", max: 5 },
    { name: "priority80Prefix", label: "Prefixo 80+", max: 5 },
    {
      name: "callMode",
      label: "Forma de chamada",
      choices: [
        ["TICKET", "Por senha"],
        ["NAME", "Por nome"],
      ],
    },
    {
      name: "ratioNormal",
      label: "Chamadas normais por ciclo",
      type: "number",
      min: 1,
      max: 20,
      value: 2,
    },
    {
      name: "ratioPreferential",
      label: "Preferenciais por ciclo",
      type: "number",
      min: 1,
      max: 20,
      value: 1,
    },
    {
      name: "stageOrder",
      label: "Etapa do atendimento",
      type: "number",
      min: 1,
      max: 99,
      value: 1,
    },
  ],
  counters: [
    { name: "name", label: "Nome do guichê" },
    { name: "number", label: "Número", type: "number", min: 1, max: 999 },
  ],
  users: [
    { name: "name", label: "Nome da pessoa" },
    { name: "email", label: "E-mail", type: "email" },
    {
      name: "role",
      label: "Permissão",
      choices: [
        ["ATTENDANT", "Atendente"],
        ["ADMIN", "Administrador"],
      ],
    },
    {
      name: "password",
      label: "Senha com ao menos 12 caracteres",
      type: "password",
      min: 12,
    },
  ],
};
const settingFields: Field[] = [
  { name: "name", label: "Nome da empresa" },
  { name: "unitName", label: "Nome da unidade" },
  { name: "timeZone", label: "Fuso horário", value: "America/Sao_Paulo" },
  {
    name: "resetTime",
    label: "Horário de reinício diário",
    type: "time",
    value: "00:00",
  },
  {
    name: "retentionDays",
    label: "Retenção de nomes em dias",
    type: "number",
    min: 1,
    max: 365,
    value: 30,
  },
];

function Fields({
  items,
  values,
  editing = false,
}: {
  items: Field[];
  values?: object;
  editing?: boolean;
}) {
  return items.map(
    ({ name, label, type, choices, value, optional, min, max }) => {
      const saved = values
        ? (values as Record<string, string | number>)[name]
        : undefined;
      const required = !optional && !(editing && name === "password");
      return (
        <label key={name}>
          {label}
          {choices ? (
            <select name={name} defaultValue={saved ?? choices[0]?.[0]}>
              {choices.map(([key, text]) => (
                <option key={key} value={key}>
                  {text}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={name}
              type={type || "text"}
              required={required}
              defaultValue={saved ?? value}
              min={type === "number" ? min : undefined}
              max={type === "number" ? max : undefined}
              minLength={type === "password" ? min : undefined}
              maxLength={type !== "number" ? max : undefined}
              autoComplete={type === "password" ? "new-password" : undefined}
            />
          )}
        </label>
      );
    },
  );
}

export function Admin({ actor }: { actor: Actor }) {
  const [data, setData] = useState<AdminData>();
  const [section, setSection] = useState<Collection | "settings" | "templates">(
    "services",
  );
  const [editor, setEditor] = useState<Entity | "new" | null>(null);
  const [recovering, setRecovering] = useState<OpenShift | null>(null);
  const [shifts, setShifts] = useState<OpenShift[]>([]);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setData(await api<AdminData>("/admin"));
  }, []);
  const loadShifts = useCallback(async () => {
    setShifts(await api<OpenShift[]>("/admin/shifts"));
  }, []);

  useEffect(() => {
    void load().catch((error) => setError(message(error)));
  }, [load]);
  useEffect(() => {
    if (section === "counters")
      void loadShifts().catch((error) => setError(message(error)));
  }, [loadShifts, section]);
  const followShifts = useCallback(
    (socket: Socket) => {
      const refresh = () =>
        void loadShifts().catch((error) => setError(message(error)));
      socket.on("connect", refresh);
      socket.on("shift.changed", refresh);
      socket.on("ticket.updated", refresh);
    },
    [loadShifts],
  );
  useRealtime(followShifts, undefined, section === "counters");

  async function act(
    path: string,
    method: string,
    body?: unknown,
    success = "Alterações salvas.",
  ) {
    setBusy(true);
    setError("");
    setConfirmation("");
    try {
      await api(path, method, body);
      setEditor(null);
      setRecovering(null);
      await load();
      if (section === "counters") await loadShifts();
      setConfirmation(success);
    } catch (error) {
      setError(message(error));
      if (error instanceof ApiError && error.status === 409) {
        setRecovering(null);
        if (section === "counters") await loadShifts().catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }

  function submit(
    event: FormEvent<HTMLFormElement>,
    path: string,
    method: string,
    active?: boolean,
  ) {
    event.preventDefault();
    const body: Record<string, unknown> = Object.fromEntries(
      new FormData(event.currentTarget),
    );
    if (active !== undefined) body.active = body.active === "on";
    if (body.password === "") delete body.password;
    void act(path, method, body);
  }

  function select(next: typeof section) {
    setSection(next);
    setEditor(null);
    setRecovering(null);
    setError("");
    setConfirmation("");
  }

  function submitRecovery(event: FormEvent<HTMLFormElement>, shift: OpenShift) {
    event.preventDefault();
    const action = new FormData(event.currentTarget).get("action");
    const body: RecoverShiftInput =
      shift.ticket && (action === "REQUEUE" || action === "CANCEL")
        ? {
            ticket: {
              id: shift.ticket.id,
              status: shift.ticket.status,
              action,
            },
          }
        : {};
    void act(
      `/admin/shifts/${shift.id}/recover`,
      "POST",
      body,
      "Turno encerrado. Guichê liberado.",
    );
  }

  if (!data)
    return (
      <main className="workspace">
        <p role={error ? "alert" : "status"}>
          {error || "Carregando administração…"}
        </p>
      </main>
    );
  const collection =
    section === "settings" || section === "templates" ? null : section;
  const existing = editor && editor !== "new" ? editor : undefined;
  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <p className="eyebrow">{data.unit.name}</p>
          <h1>Administração</h1>
          <p>Configure os serviços, guichês e a equipe da sua unidade.</p>
        </div>
      </div>
      <nav className="tabs" aria-label="Áreas da administração">
        {(Object.keys(sections) as Collection[]).map((key) => (
          <button
            key={key}
            aria-current={section === key ? "page" : undefined}
            onClick={() => select(key)}
          >
            <Icon name={sectionIcons[key]} />
            {sections[key]}
          </button>
        ))}
        <button
          aria-current={section === "settings" ? "page" : undefined}
          onClick={() => select("settings")}
        >
          <Icon name="building" /> Unidade
        </button>
        {actor.role === "SUPERADMIN" && (
          <button
            aria-current={section === "templates" ? "page" : undefined}
            onClick={() => select("templates")}
          >
            <Icon name="layers" /> Modelos
          </button>
        )}
      </nav>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {confirmation && (
        <p role="status" className="confirmation">
          {confirmation}
        </p>
      )}
      {collection && (
        <section className="surface">
          <div className="section-head">
            <h2>{sections[collection]}</h2>
            <button className="primary" onClick={() => setEditor("new")}>
              <Icon name="plus" /> Adicionar {singular[collection]}
            </button>
          </div>
          {editor && (
            <form
              key={existing?.id ?? "new"}
              className="editor"
              onSubmit={(event) =>
                submit(
                  event,
                  `/admin/${collection}${existing ? `/${existing.id}` : ""}`,
                  existing ? "PUT" : "POST",
                  true,
                )
              }
            >
              <h3>
                {existing ? "Editar" : "Adicionar"} {singular[collection]}
              </h3>
              <div className="form-grid">
                <Fields
                  items={fields[collection]}
                  values={existing}
                  editing={Boolean(existing)}
                />
              </div>
              {existing && collection === "users" && (
                <p>
                  Ao definir uma nova senha, os acessos anteriores da conta
                  serão encerrados.
                </p>
              )}
              <label className="checkbox">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={existing?.active ?? true}
                />{" "}
                Ativo
              </label>
              <div className="actions">
                <button type="button" onClick={() => setEditor(null)}>
                  Cancelar
                </button>
                <button className="primary" disabled={busy}>
                  <Icon name="check" /> Salvar
                </button>
              </div>
            </form>
          )}
          {collection === "counters" && recovering && (
            <form
              key={recovering.id}
              className="editor"
              onSubmit={(event) => submitRecovery(event, recovering)}
            >
              <h3>
                Liberar{" "}
                {data.counters.find(({ id }) => id === recovering.counterId)
                  ?.name ?? "guichê"}
              </h3>
              <p>O turno de {recovering.attendant} será encerrado.</p>
              {recovering.ticket && (
                <>
                  <p>
                    Senha {recovering.ticket.code} ·{" "}
                    {ticketStatusLabels[recovering.ticket.status]}
                  </p>
                  <label>
                    O que fazer com a senha?
                    <select name="action" defaultValue="" required>
                      <option value="" disabled>
                        Selecione uma ação
                      </option>
                      {recovering.ticket.canRequeue && (
                        <option value="REQUEUE">
                          Devolver ao fim da fila da mesma prioridade
                        </option>
                      )}
                      <option value="CANCEL">Cancelar a senha</option>
                    </select>
                  </label>
                </>
              )}
              <div className="actions">
                <button type="button" onClick={() => setRecovering(null)}>
                  Voltar
                </button>
                <button className="primary" disabled={busy}>
                  <Icon name="check" /> Confirmar liberação
                </button>
              </div>
            </form>
          )}
          {data[collection].length === 0 ? (
            <p className="empty">Nenhum cadastro nesta área.</p>
          ) : (
            <ul className="records">
              {data[collection].map((entity) => {
                const shift =
                  collection === "counters" &&
                  shifts.find(({ counterId }) => counterId === entity.id);
                return (
                  <li key={entity.id}>
                    <div>
                      <strong>{entity.name}</strong>
                      <p>
                        {"prefix" in entity
                          ? `Etapa ${entity.stageOrder} · ${entity.prefix} / ${entity.preferentialPrefix} / ${entity.priority80Prefix}`
                          : "number" in entity
                            ? `Guichê ${entity.number}`
                            : `${roles[entity.role]} · ${entity.email}`}
                      </p>
                      {shift && <p>Turno aberto · {shift.attendant}</p>}
                    </div>
                    <span className={entity.active ? "pill" : "pill inactive"}>
                      {entity.active ? "Ativo" : "Inativo"}
                    </span>
                    {entity.id !== actor.id &&
                      (!("role" in entity) || entity.role !== "SUPERADMIN") && (
                        <div className="actions">
                          <button onClick={() => setEditor(entity)}>
                            <Icon name="edit" /> Editar
                          </button>
                          {shift && (
                            <button
                              disabled={busy}
                              onClick={() => {
                                setEditor(null);
                                setRecovering(shift);
                              }}
                            >
                              <Icon name="unlock" /> Liberar guichê
                            </button>
                          )}
                          {entity.active && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void act(
                                  `/admin/${collection}/${entity.id}`,
                                  "DELETE",
                                  undefined,
                                  "Cadastro desativado.",
                                )
                              }
                            >
                              <Icon name="lock" /> Desativar
                            </button>
                          )}
                        </div>
                      )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      {section === "settings" && (
        <section className="surface">
          <div className="section-head">
            <h2>Configuração da unidade</h2>
          </div>
          <form
            className="editor"
            onSubmit={(event) => submit(event, "/admin/settings", "PUT")}
          >
            <div className="form-grid">
              <Fields
                items={settingFields}
                values={{ ...data.tenant, unitName: data.unit.name }}
              />
            </div>
            <div className="actions">
              <button className="primary" disabled={busy}>
                <Icon name="check" /> Salvar configuração
              </button>
            </div>
          </form>
        </section>
      )}
      {section === "templates" && actor.role === "SUPERADMIN" && (
        <section className="surface">
          <div className="section-head">
            <div>
              <h2>Modelos de atendimento</h2>
              <p>
                Salve os serviços e guichês ativos da unidade Beend como um
                modelo para novas empresas.
              </p>
            </div>
          </div>
          <form
            className="editor"
            onSubmit={(event) => submit(event, "/admin/templates", "POST")}
          >
            <label>
              Nome do modelo
              <input required name="name" maxLength={100} />
            </label>
            <div>
              <button className="primary" disabled={busy}>
                <Icon name="check" /> Salvar modelo
              </button>
            </div>
          </form>
          <ul className="records">
            {data.templates.map(({ id, name }) => (
              <li key={id}>
                <strong>{name}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
      {collection &&
        data.services.length === 0 &&
        data.counters.length === 0 && (
          <section className="surface templates">
            <div>
              <h2>Comece com um modelo</h2>
              <p>
                Preencha os serviços e guichês da unidade com uma configuração
                inicial.
              </p>
            </div>
            <div className="actions">
              {data.templates.map((template) => (
                <button
                  key={template.id}
                  disabled={busy}
                  onClick={() =>
                    void act(
                      "/admin/template",
                      "POST",
                      { templateId: template.id },
                      "Modelo aplicado.",
                    )
                  }
                >
                  {template.name}
                </button>
              ))}
            </div>
          </section>
        )}
    </main>
  );
}
