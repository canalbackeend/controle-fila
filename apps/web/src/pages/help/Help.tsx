import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Actor } from "@beend/shared";
import { LegalLinks } from "../legal/LegalPage";
import { supportChannels } from "../legal/company";
import { articlesFor, helpArticles, type HelpArticle } from "./articles";

function Contact({ actor }: { actor: Actor }) {
  const channels = supportChannels();
  const attendant = actor.role === "ATTENDANT";
  return (
    <section className="surface help-contact" aria-labelledby="help-contact">
      <h2 id="help-contact">Fale com o suporte</h2>
      {attendant ? (
        <p>
          Para dúvidas sobre a fila, o guichê ou sua conta, procure o
          administrador da sua empresa.
        </p>
      ) : channels.length ? (
        <dl>
          {channels.map(({ label, value, href }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer">
                    {value}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>Use os canais de suporte da Beend informados no seu contrato.</p>
      )}
      {!attendant && (
        <p>
          Informe o nome da empresa, o aparelho ou a tela com problema e, se
          possível, uma foto da tela.
        </p>
      )}
    </section>
  );
}

function Article({ article }: { article: HelpArticle }) {
  return (
    <article className="surface help-article" aria-labelledby="help-title">
      <h2 id="help-title">{article.title}</h2>
      <p className="help-summary">{article.summary}</p>
      {article.sections.map((section) => (
        <section key={section.title}>
          <h3>{section.title}</h3>
          {section.steps && (
            <ol>
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          {section.items && (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
    </article>
  );
}

export function Help({ actor }: { actor: Actor }) {
  const { artigo } = useParams();
  const [query, setQuery] = useState("");
  const allowed = articlesFor(actor.role);
  const results = articlesFor(actor.role, query);
  const selected =
    allowed.find(({ id }) => id === artigo) ??
    (query ? results[0] : allowed[0]) ??
    helpArticles[0]!;

  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <p className="eyebrow">Central de ajuda</p>
          <h1>Como podemos ajudar?</h1>
          <p>Guias do Beend Fila para cada etapa do atendimento.</p>
        </div>
      </div>
      <div className="help-layout">
        <div className="help-index">
          <label>
            Buscar na ajuda
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="ex. impressora, voz, senha"
            />
          </label>
          <nav aria-label="Artigos da ajuda">
            {results.length ? (
              <ul>
                {results.map((article) => (
                  <li key={article.id}>
                    <Link
                      to={`/ajuda/${article.id}`}
                      aria-current={
                        article.id === selected.id ? "page" : undefined
                      }
                    >
                      {article.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status">Nenhum artigo encontrado.</p>
            )}
          </nav>
          <Contact actor={actor} />
        </div>
        <div>
          <Article article={selected} />
          <LegalLinks />
        </div>
      </div>
    </main>
  );
}
