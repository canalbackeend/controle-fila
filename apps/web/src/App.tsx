import { BrandLogo } from "./components/BrandLogo";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { readTheme, type Actor, type TenantTheme } from "@beend/shared";
import type { Socket } from "socket.io-client";
import { useRealtime } from "./realtime";
import { themeStyle } from "./theme";
import { ThemeSettings } from "./pages/settings/ThemeSettings";
import { Profile } from "./pages/settings/Profile";
import { api, message } from "./api";
import { Login } from "./pages/auth/Login";
import { Content } from "./pages/content/Content";
import { PanelEditor } from "./pages/content/PanelEditor";
import { Reports } from "./pages/reports/Reports";
import { Tracking } from "./pages/tracking/Tracking";
import { Panel } from "./pages/panel/Panel";
import { Kiosk } from "./pages/kiosk/Kiosk";
import { Devices } from "./pages/devices/Devices";
import { Attendant } from "./pages/attendant/Attendant";
import { Admin } from "./pages/admin/Admin";

const Companies = lazy(() =>
  import("./pages/platform/Companies").then(({ Companies }) => ({
    default: Companies,
  })),
);
const PlatformDevices = lazy(() =>
  import("./pages/platform/PlatformDevices").then(({ PlatformDevices }) => ({
    default: PlatformDevices,
  })),
);

function Workspace({
  actor,
  onLogout,
  children,
}: {
  actor: Actor;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [error, setError] = useState("");
  async function logout() {
    try {
      await api("/auth/logout", "POST");
      onLogout();
    } catch (error) {
      setError(message(error));
    }
  }
  return (
    <div
      className="theme workspace-theme"
      style={themeStyle(
        actor.role === "ATTENDANT"
          ? (actor.personalTheme ?? actor.theme)
          : actor.theme,
      )}
    >
      <header className="app-header">
        <Link className="brand" to="/" aria-label="Beend Fila">
          <BrandLogo />
        </Link>
        <nav aria-label="Navegação principal">
          {!actor.mustChangePassword && actor.role === "SUPERADMIN" && (
            <>
              <Link to="/plataforma/empresas">Empresas</Link>
              <Link to="/plataforma/dispositivos">
                Dispositivos dos clientes
              </Link>
            </>
          )}
          {!actor.mustChangePassword && actor.role !== "ATTENDANT" && (
            <>
              <Link to="/admin">
                {actor.role === "SUPERADMIN"
                  ? "Operação Beend"
                  : "Administração"}
              </Link>
              <Link to="/admin/dispositivos">Dispositivos</Link>
              <Link to="/admin/conteudo">Conteúdo</Link>
              <Link to="/admin/relatorios">Relatórios</Link>
              <Link to="/admin/configuracoes">Configurações</Link>
            </>
          )}
          {!actor.mustChangePassword && (
            <Link to="/atendente">Atendimento</Link>
          )}
          <Link to="/perfil" title={actor.name}>
            Meu perfil
          </Link>
          <button onClick={() => void logout()}>Sair</button>
        </nav>
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {children}
    </div>
  );
}

export function App() {
  const [actor, setActor] = useState<Actor | null | undefined>(undefined);
  const { pathname } = useLocation();
  const publicPage = /^\/(t|totem|painel)(\/|$)/.test(pathname);
  useEffect(() => {
    if (publicPage) return;
    let active = true;
    void api<Actor>("/auth/session").then(
      (actor) => {
        if (active) setActor(actor);
      },
      () => {
        if (active) setActor(null);
      },
    );
    return () => {
      active = false;
    };
  }, [publicPage]);

  const updateTheme = useCallback((theme: TenantTheme) => {
    setActor((known) => (known ? { ...known, theme } : known));
  }, []);
  const followTheme = useCallback(
    (socket: Socket) => {
      socket.on("tenant.suspended", () => setActor(null));
      socket.on("account.credentials", () => setActor(null));
      socket.on("tenant.theme", (theme: unknown) =>
        updateTheme(readTheme(theme)),
      );
      socket.on("connect", () => {
        void api<Actor>("/auth/session").then(
          (fresh) =>
            setActor((known) => (known?.id === fresh.id ? fresh : known)),
          () => {},
        );
      });
    },
    [updateTheme],
  );
  useRealtime(
    followTheme,
    undefined,
    Boolean(actor && !actor.mustChangePassword) && !publicPage,
  );

  function protectedPage(children: (actor: Actor) => React.ReactNode) {
    if (actor === undefined)
      return (
        <main className="workspace">
          <h1>Beend Fila</h1>
          <p role="status">Carregando…</p>
        </main>
      );
    if (!actor) return <Navigate to="/entrar" replace />;
    if (actor.mustChangePassword && pathname !== "/perfil")
      return <Navigate to="/perfil" replace />;
    return (
      <Workspace actor={actor} onLogout={() => setActor(null)}>
        {children(actor)}
      </Workspace>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={protectedPage((actor) => (
          <Navigate
            to={
              actor.role === "SUPERADMIN"
                ? "/plataforma/empresas"
                : actor.role === "ATTENDANT"
                  ? "/atendente"
                  : "/admin"
            }
            replace
          />
        ))}
      />
      <Route
        path="/entrar"
        element={
          actor ? <Navigate to="/" replace /> : <Login onLogin={setActor} />
        }
      />
      <Route
        path="/plataforma/empresas"
        element={protectedPage((actor) =>
          actor.role === "SUPERADMIN" ? (
            <Suspense
              fallback={
                <main className="workspace">
                  <p role="status">Carregando plataforma…</p>
                </main>
              }
            >
              <Companies />
            </Suspense>
          ) : (
            <Navigate to="/" replace />
          ),
        )}
      />
      <Route
        path="/plataforma/dispositivos"
        element={protectedPage((actor) =>
          actor.role === "SUPERADMIN" ? (
            <Suspense
              fallback={
                <main className="workspace">
                  <p role="status">Carregando dispositivos…</p>
                </main>
              }
            >
              <PlatformDevices />
            </Suspense>
          ) : (
            <Navigate to="/" replace />
          ),
        )}
      />
      <Route
        path="/admin"
        element={protectedPage((actor) =>
          actor.role === "ATTENDANT" ? (
            <Navigate to="/atendente" replace />
          ) : (
            <Admin actor={actor} />
          ),
        )}
      />
      <Route
        path="/admin/dispositivos"
        element={protectedPage((actor) =>
          actor.role === "ATTENDANT" ? (
            <Navigate to="/atendente" replace />
          ) : (
            <Devices />
          ),
        )}
      />
      <Route
        path="/admin/conteudo"
        element={protectedPage((actor) =>
          actor.role === "ATTENDANT" ? (
            <Navigate to="/atendente" replace />
          ) : (
            <Content actor={actor} />
          ),
        )}
      />
      <Route
        path="/admin/painel/:id"
        element={protectedPage((actor) =>
          actor.role === "ATTENDANT" ? (
            <Navigate to="/atendente" replace />
          ) : (
            <PanelEditor />
          ),
        )}
      />
      <Route
        path="/admin/relatorios"
        element={protectedPage((actor) =>
          actor.role === "ATTENDANT" ? (
            <Navigate to="/atendente" replace />
          ) : (
            <Reports actor={actor} />
          ),
        )}
      />
      <Route
        path="/admin/configuracoes"
        element={protectedPage((actor) =>
          actor.role === "ATTENDANT" ? (
            <Navigate to="/atendente" replace />
          ) : (
            <ThemeSettings
              key={actor.tenantId}
              current={actor.theme}
              tenantName={actor.tenantName}
              onSave={updateTheme}
            />
          ),
        )}
      />
      <Route
        path="/perfil"
        element={protectedPage((actor) => (
          <Profile
            key={actor.id}
            actor={actor}
            onSave={setActor}
            onCompanyThemeSave={updateTheme}
            onPersonalThemeSave={(personalTheme) =>
              setActor((known) =>
                known?.id === actor.id ? { ...known, personalTheme } : known,
              )
            }
          />
        ))}
      />
      <Route path="/t/:token" element={<Tracking />} />
      <Route path="/totem/:id?" element={<Kiosk />} />
      <Route path="/painel/:id?" element={<Panel />} />
      <Route
        path="/atendente"
        element={protectedPage((actor) => (
          <Attendant actor={actor} />
        ))}
      />
      <Route
        path="*"
        element={
          <main className="workspace">
            <h1>Página indisponível</h1>
            <Link to="/">Voltar ao início</Link>
          </main>
        }
      />
    </Routes>
  );
}
