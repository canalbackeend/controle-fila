import { Link, Route, Routes } from "react-router-dom";

export function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <main className="mx-auto max-w-3xl px-6 py-16">
            <h1 className="text-4xl font-bold">Beend Fila</h1>
          </main>
        }
      />
      <Route
        path="*"
        element={
          <main className="mx-auto max-w-3xl px-6 py-16">
            <h1 className="text-2xl font-bold">Página indisponível</h1>
            <Link to="/">Voltar ao início</Link>
          </main>
        }
      />
    </Routes>
  );
}
