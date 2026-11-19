import type { DeviceLink } from "@beend/shared";

export function devicePath(device: DeviceLink) {
  return `/${device.type === "KIOSK" ? "totem" : "painel"}/${device.id}`;
}
