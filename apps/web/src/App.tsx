import { BrandLogo } from "./components/BrandLogo";
import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { Actor } from "@beend/shared";
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
    <>
      <header className="app-header">
        <Link className="brand" to="/" aria-label="Beend Fila">
          <BrandLogo />
        </Link>
        <nav aria-label="Navegação principal">
          {actor.role !== "ATTENDANT" && (
            <>
              <Link to="/admin">Administração</Link>
              <Link to="/admin/dispositivos">Dispositivos</Link>
              <Link to="/admin/conteudo">Conteúdo</Link>
              <Link to="/admin/relatorios">Relatórios</Link>
            </>
          )}
          <Link to="/atendente">Atendimento</Link>
          <span>{actor.name}</span>
          <button onClick={() => void logout()}>Sair</button>
        </nav>
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {children}
    </>
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

  function protectedPage(children: (actor: Actor) => React.ReactNode) {
    if (actor === undefined)
      return (
        <main className="workspace">
          <h1>Beend Fila</h1>
          <p role="status">Carregando…</p>
        </main>
      );
    if (!actor) return <Navigate to="/entrar" replace />;
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
            to={actor.role === "ATTENDANT" ? "/atendente" : "/admin"}
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
