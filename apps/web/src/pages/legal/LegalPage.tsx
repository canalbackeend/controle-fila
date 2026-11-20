import { Link } from "react-router-dom";
import { BrandLogo } from "../../components/BrandLogo";
import { company } from "./company";
import { privacyPolicy, termsOfUse } from "./documents";

const documents = {
  privacy: { path: "/privacidade", document: privacyPolicy },
  terms: { path: "/termos", document: termsOfUse },
} as const;

export function LegalPage({ kind }: { kind: keyof typeof documents }) {
  const { document } = documents[kind];
  const other = documents[kind === "privacy" ? "terms" : "privacy"];
  return (
    <main className="legal">
      <header className="legal-header">
        <Link className="brand" to="/" aria-label={company.product}>
          <BrandLogo />
        </Link>
        <nav aria-label="Documentos">
          <Link to={other.path}>{other.document.title}</Link>
        </nav>
      </header>
      <article className="legal-article">
        <h1>{document.title}</h1>
        <p className="legal-updated">
          Última atualização: {company.legalUpdatedAt}
        </p>
        <p>{document.intro}</p>
        {document.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.items && (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>
    </main>
  );
}

export function LegalLinks() {
  return (
    <nav className="legal-links" aria-label="Documentos legais">
      <Link to="/privacidade">Política de Privacidade</Link>
      <Link to="/termos">Termos de Uso</Link>
    </nav>
  );
}
