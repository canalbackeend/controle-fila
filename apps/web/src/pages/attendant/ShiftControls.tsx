import { useState, type FormEvent } from "react";
import type {
  AttendantState,
  ShiftInput,
  ShiftServicesInput,
} from "@beend/shared";
import { Icon } from "../../components/Icon";

type ShiftControlsProps = Pick<
  AttendantState,
  "counters" | "services" | "session" | "active"
> & {
  busy: boolean;
  onStart: (input: ShiftInput) => Promise<boolean>;
  onChangeServices: (input: ShiftServicesInput) => Promise<boolean>;
  onEnd: () => Promise<boolean>;
};

export function ShiftControls({
  counters,
  services,
  session,
  active,
  busy,
  onStart,
  onChangeServices,
  onEnd,
}: ShiftControlsProps) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const available = counters.filter(({ occupied }) => !occupied);
  const selectedActive = services.filter(({ id }) => selected.includes(id));
  const activeServices = services.filter(({ id }) =>
    session?.serviceIds.includes(id),
  );
  const canOpen = available.length > 0 && services.length > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const serviceIds = selectedActive.map(({ id }) => id);
    if (session) {
      if (await onChangeServices({ shiftId: session.id, serviceIds }))
        setEditing(false);
    } else {
      const counterId = new FormData(event.currentTarget).get("counter");
      if (typeof counterId === "string")
        await onStart({ counterId, serviceIds });
    }
  }

  return (
    <section className="surface" id="turno">
      <div className="section-head">
        <div>
          <h2>Meu turno</h2>
          <p>
            {session
              ? session.counterName
              : "Escolha o guichê e os serviços que você vai atender."}
          </p>
        </div>
        <span className={session ? "pill" : "pill inactive"}>
          {session ? "Turno aberto" : "Sem turno aberto"}
        </span>
      </div>
      {session && !editing && (
        <div className="editor">
          <p>
            Serviços atendidos{" "}
            <strong>
              {activeServices.map(({ name }) => name).join(", ") ||
                "Nenhum serviço ativo selecionado"}
            </strong>
          </p>
          {active && (
            <p>Resolva a senha {active.code} para encerrar o turno.</p>
          )}
          <div className="actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setSelected(session.serviceIds);
                setEditing(true);
              }}
            >
              <Icon name="edit" /> Alterar serviços
            </button>
            <button
              type="button"
              disabled={busy || Boolean(active)}
              onClick={() => void onEnd()}
            >
              <Icon name="logout" /> Encerrar turno
            </button>
          </div>
        </div>
      )}
      {(!session || editing) && (
        <form className="editor" onSubmit={(event) => void submit(event)}>
          {!session && (
            <label>
              Guichê
              <select
                required
                name="counter"
                defaultValue=""
                disabled={!canOpen || busy}
              >
                <option value="" disabled>
                  Selecione um guichê
                </option>
                {counters.map(({ id, name, occupied }) => (
                  <option key={id} value={id} disabled={occupied}>
                    {name}
                    {occupied ? " · Em uso" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {services.length > 0 && (
            <fieldset disabled={busy}>
              <legend>Serviços atendidos</legend>
              <div className="check-grid">
                {services.map(({ id, name }) => (
                  <label key={id} className="checkbox">
                    <input
                      type="checkbox"
                      name="service"
                      value={id}
                      checked={selected.includes(id)}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setSelected((ids) =>
                          checked
                            ? [...ids, id]
                            : ids.filter((value) => value !== id),
                        );
                      }}
                    />
                    {name}
                  </label>
                ))}
              </div>
              {services.length > 1 &&
                selectedActive.length < services.length && (
                  <button
                    className="shift-select-all"
                    type="button"
                    onClick={() => setSelected(services.map(({ id }) => id))}
                  >
                    Marcar todos os serviços
                  </button>
                )}
            </fieldset>
          )}
          {!services.length || (!session && !counters.length) ? (
            <p>
              Cadastre guichês e serviços ativos na Administração para começar.
            </p>
          ) : !session && !available.length ? (
            <p>
              Todos os guichês estão em uso. Aguarde a liberação de um guichê.
            </p>
          ) : null}
          <div className="actions">
            {editing && (
              <button type="button" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            )}
            <button
              className="primary"
              disabled={
                busy || !selectedActive.length || (!session && !canOpen)
              }
            >
              <Icon name={session ? "check" : "unlock"} />{" "}
              {session ? "Salvar serviços" : "Iniciar turno"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
