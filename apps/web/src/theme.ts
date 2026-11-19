import type { CSSProperties } from "react";
import { defaultTheme, themeColor, type TenantTheme } from "@beend/shared";

function luminance(red: number, green: number, blue: number) {
  const linear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

export function themeStyle(theme: TenantTheme = defaultTheme): CSSProperties {
  const hex = themeColor(theme);
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  let scale = 1;
  while (
    1.05 / (luminance(red * scale, green * scale, blue * scale) + 0.05) <
    4.7
  ) {
    scale -= 0.04;
  }
  return {
    "--theme-base": hex,
    "--theme-accessible": `rgb(${Math.round(red * scale)}, ${Math.round(green * scale)}, ${Math.round(blue * scale)})`,
  } as CSSProperties;
}
