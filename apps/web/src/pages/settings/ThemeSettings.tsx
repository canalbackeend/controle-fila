import type { TenantTheme } from "@beend/shared";
import { api } from "../../api";
import { ThemeEditor } from "./ThemeEditor";

export function ThemeSettings({
  current,
  onSave,
}: {
  current: TenantTheme;
  onSave: (theme: TenantTheme) => void;
}) {
  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <h1>Configurações</h1>
          <p>
            Escolha as cores que identificam sua empresa em todo o Beend Fila.
          </p>
        </div>
      </div>
      <ThemeEditor
        current={current}
        onSave={async (theme) => {
          if (theme)
            onSave(await api<TenantTheme>("/admin/theme", "PUT", theme));
        }}
      />
    </main>
  );
}
