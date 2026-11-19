import { Icon } from "../../components/Icon";
import { useEffect, useState } from "react";
import type { CompanyAdministrator, PlatformCompany } from "@beend/shared";
import { api, message } from "../../api";

export function CompanyAccess({
  company,
  busy,
  onClose,
  onReset,
}: {
  company: PlatformCompany;
  busy: boolean;
  onClose: () => void;
  onReset: (email: string) => void;
}) {
  const [administrators, setAdministrators] =
    useState<CompanyAdministrator[]>();
  const [error, setError] = useState("");
  const login = new URL("/entrar", window.location.origin);
  login.searchParams.set("empresa", company.slug);

  useEffect(() => {
    let active = true;
    void api<CompanyAdministrator[]>(
      `/admin/tenants/${company.id}/administrators`,
    ).then(
      (result) => {
        if (active) setAdministrators(result);
      },
      (error) => {
        if (active) setError(message(error));
      },
    );
    return () => {
      active = false;
    };
  }, [company.id]);

  return (
    <section className="surface" aria-label={`Acessos de ${company.name}`}>
      <div className="section-head">
        <div>
          <h2>Acessos de {company.name}</h2>
          <p>
            Identificador da empresa <strong>{company.slug}</strong>
          </p>
        </div>
        <button onClick={onClose}>Fechar acessos</button>
      </div>
      <div className="editor">
        <label>
          Endereço de login da empresa
          <input
            readOnly
            value={login.href}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
        <p>
          Para recuperar o acesso de um administrador, gere uma senha
          provisória. Ela será exibida quando for gerada.
        </p>
      </div>
      {error ? (
        <p className="empty" role="alert">
          {error}
        </p>
      ) : !administrators ? (
        <p className="empty" role="status">
          Carregando administradores…
        </p>
      ) : !administrators.length ? (
        <p className="empty">Nenhum administrador encontrado.</p>
      ) : (
        <ul className="records">
          {administrators.map(({ name, email, active, mustChangePassword }) => (
            <li key={email}>
              <div>
                <strong>{name}</strong>
                <p>{email}</p>
              </div>
              <span className={active ? "pill" : "pill inactive"}>
                {active
                  ? mustChangePassword
                    ? "Troca de senha pendente"
                    : "Ativo"
                  : "Inativo"}
              </span>
              {active && (
                <button disabled={busy} onClick={() => onReset(email)}>
                  <Icon name="key" /> Gerar senha provisória
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
