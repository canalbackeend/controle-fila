import { Link } from "react-router-dom";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { DevicePairing, DeviceRecord } from "@beend/shared";
import { api, message } from "../../api";

const labels = { KIOSK: "Totem", PANEL: "Painel de TV" };
function devicePath(device: DeviceRecord) {
  return `/${device.type === "KIOSK" ? "totem" : "painel"}/${device.id}`;
}

export function Devices() {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [pairing, setPairing] = useState<DevicePairing>();
  const [editor, setEditor] = useState<DeviceRecord>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    async () => setDevices(await api<DeviceRecord[]>("/admin/devices")),
    [],
  );
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
              <select name="type">
                <option value="KIOSK">Totem</option>
                <option value="PANEL">Painel de TV</option>
              </select>
            </label>
          </div>
          <div>
            <button className="primary" disabled={busy}>
              Gerar código de pareamento
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
                Salvar nome
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
                    Editar nome
                  </button>
                  {device.type === "PANEL" && (
                    <Link to={`/admin/painel/${device.id}`}>
                      Configurar painel
                    </Link>
                  )}
                  <a href={devicePath(device)} target="_blank" rel="noreferrer">
                    Abrir dispositivo
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
                    Novo código
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Remover ${device.name}?`))
                        void mutate(`/admin/devices/${device.id}`, "DELETE");
                    }}
                  >
                    Remover
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
