import { Link } from "react-router-dom";
import { company } from "../pages/legal/company";

export function AppFooter() {
  const { email, phone } = company.support;
  return (
    <footer className="app-footer">
      <p className="app-footer-title">
        © {company.brand} {new Date().getFullYear()} - Todos os direitos
        reservados
      </p>
      <p>
        Suporte Técnico: <a href={`mailto:${email}`}>{email}</a> - Tel.:{" "}
        <a href={`tel:+${phone.replace(/\D/g, "")}`}>{phone}</a>
      </p>
      <p>{company.address}</p>
      <nav className="app-footer-links" aria-label="Documentos legais">
        <Link to="/privacidade">Política de Privacidade</Link>
        <Link to="/termos">Termos de Uso</Link>
        <Link to="/ajuda">Ajuda</Link>
      </nav>
    </footer>
  );
}
