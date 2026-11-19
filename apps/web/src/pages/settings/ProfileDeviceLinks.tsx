import { useEffect, useState } from "react";
import type { DeviceLink } from "@beend/shared";
import { api, message } from "../../api";
import { devicePath } from "../../device-links";

const labels = { KIOSK: "Terminal de senhas (totem)", PANEL: "Painel de TV" };

export function ProfileDeviceLinks() {
  const [devices, setDevices] = useState<DeviceLink[]>();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void api<DeviceLink[]>("/devices/links").then(
      (items) => {
        if (active) setDevices(items);
      },
      (error) => {
        if (active) setError(message(error));
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="surface">
      <div className="section-head">
        <h2>Dispositivos da unidade</h2>
      </div>
      {error ? (
        <p className="empty" role="alert">
          {error}
        </p>
      ) : !devices ? (
        <p className="empty" role="status">
          Carregando dispositivos…
        </p>
      ) : !devices.length ? (
        <p className="empty">
          Nenhum terminal ou painel de TV cadastrado nesta unidade.
        </p>
      ) : (
        <ul className="records">
          {devices.map((device) => (
            <li key={device.id}>
              <div>
                <a href={devicePath(device)} target="_blank" rel="noreferrer">
                  <strong>{device.name}</strong>
                </a>
                <p>{labels[device.type]}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
