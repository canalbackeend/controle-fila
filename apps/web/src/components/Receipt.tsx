import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { priorityLabels, type IssuedTicket } from "@beend/shared";

export function Receipt({
  ticket,
  close,
  autoPrint = false,
}: {
  ticket: IssuedTicket;
  close: () => void;
  autoPrint?: boolean;
}) {
  const [image, setImage] = useState("");
  const [error, setError] = useState(false);
  const url = new URL(`/t/${ticket.publicToken}`, window.location.origin).href;
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(url, { width: 232, margin: 2 }).then(
      (result) => {
        if (active) setImage(result);
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [url]);
  useEffect(() => {
    if (!image || !autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [autoPrint, image]);

  return (
    <section className="surface receipt">
      <div className="print-receipt">
        <p className="receipt-unit">{ticket.unitName}</p>
        <h2 className="receipt-code">{ticket.code}</h2>
        <p>
          {ticket.serviceName} · {priorityLabels[ticket.priority]}
        </p>
        <p>
          {new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: ticket.timeZone,
          }).format(new Date(ticket.issuedAt))}
        </p>
        <p>
          {ticket.peopleAhead}{" "}
          {ticket.peopleAhead === 1 ? "pessoa à frente" : "pessoas à frente"}
        </p>
        {image && (
          <img
            src={image}
            width="136"
            height="136"
            alt="QR Code de acompanhamento da senha"
          />
        )}
        {error && <p role="alert">Não foi possível gerar o QR Code.</p>}
        <a href={url} target="_blank" rel="noreferrer">
          Acompanhar no celular
        </a>
      </div>
      <div className="actions receipt-actions">
        <button type="button" onClick={() => window.print()} disabled={!image}>
          Imprimir senha
        </button>
        <button className="primary" type="button" onClick={close}>
          Concluir
        </button>
      </div>
    </section>
  );
}
