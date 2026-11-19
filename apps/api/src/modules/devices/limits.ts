import type { DeviceAllowance, DeviceType } from "@beend/shared";
import { HttpError } from "../../errors.js";

type Limits = { kioskLimit: number | null; panelLimit: number | null };

export function allowance(
  limits: Limits,
  kiosks: number,
  panels: number,
): DeviceAllowance {
  return {
    KIOSK: { used: kiosks, limit: limits.kioskLimit },
    PANEL: { used: panels, limit: limits.panelLimit },
  };
}

export function canCreateDevice(
  limits: Limits,
  type: DeviceType,
  used: number,
) {
  const limit = type === "KIOSK" ? limits.kioskLimit : limits.panelLimit;
  if (limit !== null && used >= limit) {
    throw new HttpError(
      409,
      `O limite de ${type === "KIOSK" ? "totens" : "painéis de TV"} da empresa foi atingido. Fale com a Beend para liberar mais dispositivos.`,
    );
  }
}

export function assertLimits(limits: Limits, kiosks: number, panels: number) {
  if (
    (limits.kioskLimit !== null && kiosks > limits.kioskLimit) ||
    (limits.panelLimit !== null && panels > limits.panelLimit)
  ) {
    throw new HttpError(
      409,
      "O novo limite é menor que a quantidade de dispositivos cadastrados. Remova os excedentes antes de reduzir.",
    );
  }
}
