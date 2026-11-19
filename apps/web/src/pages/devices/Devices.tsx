import { Icon } from "../../components/Icon";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type {
  DeviceAllowance,
  DevicePairing,
  DeviceRecord,
  DeviceType,
} from "@beend/shared";
import { devicePath } from "../../device-links";
import { api, message } from "../../api";

const labels = { KIOSK: "Totem", PANEL: "Painel de TV" };
export function Devices() {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [allowance, setAllowance] = useState<DeviceAllowance>();
  const [type, setType] = useState<DeviceType>("KIOSK");
  const selected = allowance?.[type];
  const full = Boolean(
    selected && selected.limit !== null && selected.used >= selected.limit,
  );
  const [pairing, setPairing] = useState<DevicePairing>();
  const [editor, setEditor] = useState<DeviceRecord>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [list, quota] = await Promise.all([
      api<DeviceRecord[]>("/admin/devices"),
      api<DeviceAllowance>("/admin/devices/allowance"),
    ]);
    setDevices(list);
    setAllowance(quota);
  }, []);
  useEffect(() => {
    void load().catch((error) => setError(message(error)));
  }, [load]);

  async function mutate(path: string, method: string, fields?: unknown) {
    setBusy(true);
    setError("");
    try {
      const result = await api<DevicePairing | undefined>(path, method, fields);
      setPairing(result);
      setEditor(undefined);
      await load();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void mutate(
      "/admin/devices",
      "POST",
      Object.fromEntries(new FormData(event.currentTarget)),
    );
  }

  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <h1>Dispositivos</h1>
          <p>Autorize totens e painéis de TV da unidade.</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {pairing && (
        <section className="surface">
          <div className="section-head">
            <div>
              <h2>Parear {pairing.device.name}</h2>
              <p>
                Abra o endereço no dispositivo e informe o código em até 15
                minutos.
              </p>
            </div>
            <button onClick={() => setPairing(undefined)}>Fechar</button>
          </div>
          <div className="editor">
            <div className="actions">
              <code className="pair-code">{pairing.code}</code>
              <a
                href={devicePath(pairing.device)}
                target="_blank"
                rel="noreferrer"
              >
                Abrir {labels[pairing.device.type].toLowerCase()}
              </a>
            </div>
          </div>
        </section>
      )}
      <section className="surface">
        <div className="section-head">
          <h2>Cadastrar dispositivo</h2>
        </div>
        <form className="editor" onSubmit={submit}>
          <div className="form-grid">
            <label>
              Nome
              <input
                name="name"
                required
                maxLength={100}
                placeholder="Ex. Totem da recepção"
              />
            </label>
            <label>
              Tipo
              <select
                name="type"
                value={type}
                onChange={(event) =>
                  setType(event.currentTarget.value as DeviceType)
                }
              >
                <option value="KIOSK">Totem</option>
                <option value="PANEL">Painel de TV</option>
              </select>
            </label>
          </div>
          {allowance && (
            <p>
              Totens {allowance.KIOSK.used}
              {allowance.KIOSK.limit === null
                ? " · sem limite"
                : ` de ${allowance.KIOSK.limit}`}{" "}
              · TVs {allowance.PANEL.used}
              {allowance.PANEL.limit === null
                ? " · sem limite"
                : ` de ${allowance.PANEL.limit}`}
            </p>
          )}
          {full && (
            <p>
              O limite deste tipo de dispositivo foi atingido. Fale com a Beend
              para ampliar a liberação.
            </p>
          )}
          <div>
            <button className="primary" disabled={busy || full || !allowance}>
              <Icon name="key" /> Gerar código de pareamento
            </button>
          </div>
        </form>
      </section>
      <section className="surface">
        <div className="section-head">
          <h2>Dispositivos cadastrados</h2>
          <button
            onClick={() =>
              void load().catch((error) => setError(message(error)))
            }
          >
            Atualizar
          </button>
        </div>
        {editor && (
          <form
            className="editor"
            key={editor.id}
            onSubmit={(event) => {
              event.preventDefault();
              void mutate(
                `/admin/devices/${editor.id}`,
                "PATCH",
                Object.fromEntries(new FormData(event.currentTarget)),
              );
            }}
          >
            <label>
              Nome do dispositivo
              <input
                name="name"
                defaultValue={editor.name}
                maxLength={100}
                required
              />
            </label>
            <div className="actions">
              <button type="button" onClick={() => setEditor(undefined)}>
                Cancelar
              </button>
              <button className="primary" disabled={busy}>
                <Icon name="check" /> Salvar nome
              </button>
            </div>
          </form>
        )}
        {devices.length ? (
          <ul className="records">
            {devices.map((device) => (
              <li key={device.id}>
                <div>
                  <strong>{device.name}</strong>
                  <p>{labels[device.type]}</p>
                </div>
                <span className={`pill ${device.paired ? "" : "inactive"}`}>
                  {device.paired ? "Pareado" : "Aguardando pareamento"}
                </span>
                <div className="actions">
                  <button type="button" onClick={() => setEditor(device)}>
                    <Icon name="edit" /> Editar nome
                  </button>
                  {device.type === "PANEL" && (
                    <Link to={`/admin/painel/${device.id}`}>
                      <Icon name="settings" /> Configurar painel
                    </Link>
                  )}
                  <a href={devicePath(device)} target="_blank" rel="noreferrer">
                    <Icon name="external" /> Abrir dispositivo
                  </a>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        !device.paired ||
                        window.confirm(
                          "Gerar outro código desconecta este dispositivo. Continuar?",
                        )
                      )
                        void mutate(
                          `/admin/devices/${device.id}/pairing`,
                          "POST",
                        );
                    }}
                  >
                    <Icon name="key" /> Novo código
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Remover ${device.name}?`))
                        void mutate(`/admin/devices/${device.id}`, "DELETE");
                    }}
                  >
                    <Icon name="trash" /> Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nenhum dispositivo cadastrado.</p>
        )}
      </section>
    </main>
  );
}
