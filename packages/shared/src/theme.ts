import { z } from "zod";

export const themePresets = {
  blue: { name: "Azul", color: "#214FB5" },
  red: { name: "Vermelho", color: "#B22540" },
  green: { name: "Verde", color: "#257450" },
  purple: { name: "Roxo", color: "#6946B2" },
  teal: { name: "Turquesa", color: "#087B80" },
} as const;

export const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .toUpperCase();
export const themeSchema = z.discriminatedUnion("preset", [
  z.strictObject({
    preset: z.enum(["blue", "red", "green", "purple", "teal"]),
  }),
  z.strictObject({ preset: z.literal("custom"), color: hexColor }),
]);
export const personalThemeInput = z.strictObject({
  theme: themeSchema.nullable(),
});
export type TenantTheme = z.infer<typeof themeSchema>;
export const defaultTheme: TenantTheme = { preset: "blue" };

export function readTheme(value: unknown): TenantTheme {
  return themeSchema.safeParse(value).data ?? defaultTheme;
}

export function themeColor(theme: TenantTheme) {
  return theme.preset === "custom"
    ? theme.color
    : themePresets[theme.preset].color;
}
