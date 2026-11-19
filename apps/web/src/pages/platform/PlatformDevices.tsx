import { useEffect, useState } from "react";
import { deviceActivitySeconds, type PlatformDevice } from "@beend/shared";
import { api, message } from "../../api";

const labels = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  UNPAIRED: "Aguardando pareamento",
  SUSPENDED: "Empresa suspensa",
};
const types = { KIOSK: "Totem", PANEL: "TV" };
export function PlatformDevices() {
  const [devices, setDevices] = useState<PlatformDevice[]>();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [onlyOnline, setOnlyOnline] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    async function refresh() {
      try {
        const updated = await api<PlatformDevice[]>("/admin/platform/devices");
        if (active) {
          setDevices(updated);
          setError("");
        }
      } catch (error) {
        if (active) setError(message(error));
      } finally {
        if (active) timer = window.setTimeout(() => void refresh(), 15000);
      }
    }
    void refresh();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const search = query.trim().toLocaleLowerCase("pt-BR");
  const online = devices?.filter(({ status }) => status === "ONLINE") ?? [];
  const filtered = devices?.filter(
    (device) =>
      (!onlyOnline || device.status === "ONLINE") &&
      (!type || device.type === type) &&
      [
        device.company.name,
        device.company.slug,
        device.name,
        device.unitName,
      ].some((field) => field.toLocaleLowerCase("pt-BR").includes(search)),
  );
  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <p className="eyebrow">Plataforma Beend</p>
          <h1>Dispositivos dos clientes</h1>
          <p>Consulte os totens e as TVs de todas as empresas.</p>
        </div>
      </div>
      <section className="surface">
        <div className="section-head">
          <div>
            <h2>Dispositivos cadastrados</h2>
            {devices && (
              <p>
                {online.filter((device) => device.type === "KIOSK").length}{" "}
                totens online ·{" "}
                {online.filter((device) => device.type === "PANEL").length} TVs
                online
              </p>
            )}
          </div>
        </div>
        <div className="editor">
          <div className="form-grid">
            <label>
              Buscar dispositivo ou empresa
              <input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </label>
            <label>
              Tipo
              <select
                value={type}
                onChange={(event) => setType(event.currentTarget.value)}
              >
                <option value="">Todos</option>
                <option value="KIOSK">Totem</option>
                <option value="PANEL">TV</option>
              </select>
            </label>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={onlyOnline}
              onChange={(event) => setOnlyOnline(event.currentTarget.checked)}
            />
            Apenas online
          </label>
          <p>
            Online indica comunicação com o servidor nos últimos{" "}
            {deviceActivitySeconds} segundos.
          </p>
        </div>
        {error ? (
          <p className="empty error" role="alert">
            {error}
          </p>
        ) : !filtered ? (
          <p className="empty" role="status">
            Carregando dispositivos…
          </p>
        ) : !filtered.length ? (
          <p className="empty">
            Nenhum dispositivo encontrado com estes filtros.
          </p>
        ) : (
          <ul className="records">
            {filtered.map((device) => (
              <li key={device.id}>
                <div>
                  <strong>{device.name}</strong>
                  <p>
                    {types[device.type]} · {device.company.name} ·{" "}
                    {device.unitName}
                  </p>
                  <p>
                    Último contato{" "}
                    {device.lastSeenAt
                      ? new Date(device.lastSeenAt).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: device.company.timeZone,
                        })
                      : "—"}
                  </p>
                </div>
                <span
                  className={
                    device.status === "ONLINE" ? "pill" : "pill inactive"
                  }
                >
                  {labels[device.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
