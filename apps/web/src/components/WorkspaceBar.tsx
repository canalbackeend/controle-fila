import { Link, useLocation } from "react-router-dom";
import type { Actor } from "@beend/shared";

const titles: [RegExp, string[]][] = [
  [/^\/atendente/, ["Atendimento"]],
  [/^\/admin\/painel\//, ["Dispositivos", "Configurar TV"]],
  [/^\/admin\/dispositivos/, ["Dispositivos"]],
  [/^\/admin\/conteudo/, ["Conteúdo"]],
  [/^\/admin\/relatorios/, ["Relatórios"]],
  [/^\/admin\/configuracoes/, ["Configurações"]],
  [/^\/plataforma\/empresas/, ["Empresas"]],
  [/^\/plataforma\/dispositivos/, ["Clientes"]],
  [/^\/plataforma\/satisfacao/, ["Satisfação"]],
  [/^\/ajuda/, ["Ajuda"]],
  [/^\/perfil/, ["Perfil"]],
];
const links: Record<string, string> = { Dispositivos: "/admin/dispositivos" };

export function workspaceTrail(pathname: string, role: Actor["role"]) {
  if (/^\/admin\/?$/.test(pathname))
    return [role === "SUPERADMIN" ? "Operações" : "Administração"];
  return titles.find(([pattern]) => pattern.test(pathname))?.[1] ?? [];
}

function today(timeZone: string) {
  const text = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(new Date());
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

export function WorkspaceBar({ actor }: { actor: Actor }) {
  const { pathname } = useLocation();
  const trail = workspaceTrail(pathname, actor.role);
  return (
    <div className="workspace-bar">
      <nav aria-label="Você está em" className="workspace-trail">
        <Link to="/">Início</Link>
        {trail.map((label, index) => {
          const last = index === trail.length - 1;
          return (
            <span key={label}>
              <span aria-hidden="true">/</span>{" "}
              {last || !links[label] ? (
                <span aria-current={last ? "page" : undefined}>{label}</span>
              ) : (
                <Link to={links[label]}>{label}</Link>
              )}
            </span>
          );
        })}
        {!trail.length && (
          <span>
            <span aria-hidden="true">/</span>{" "}
            <span aria-current="page">{actor.tenantName}</span>
          </span>
        )}
      </nav>
      <span className="workspace-date">{today(actor.timeZone)}</span>
    </div>
  );
}
