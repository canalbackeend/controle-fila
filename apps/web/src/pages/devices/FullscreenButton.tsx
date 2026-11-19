import { useEffect, useState } from "react";

type SafariDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type SafariElement = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};

function isFullscreen() {
  const doc: SafariDocument = document;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export function FullscreenButton({ floating = false, dark = false } = {}) {
  const [fullscreen, setFullscreen] = useState(isFullscreen);
  const [notice, setNotice] = useState("");
  const label = fullscreen ? "Sair da tela cheia" : "Tela cheia";

  useEffect(() => {
    const sync = () => setFullscreen(isFullscreen());
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  async function toggle() {
    const doc: SafariDocument = document;
    const root: SafariElement = doc.documentElement;
    setNotice("");
    try {
      if (doc.fullscreenElement && doc.exitFullscreen)
        await doc.exitFullscreen();
      else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen)
        await doc.webkitExitFullscreen();
      else if (doc.fullscreenEnabled && root.requestFullscreen)
        await root.requestFullscreen();
      else if (root.webkitRequestFullscreen)
        await root.webkitRequestFullscreen();
      else throw new Error("Fullscreen unavailable");
    } catch {
      setNotice(
        "Tela cheia indisponível neste navegador. Use o modo de tela cheia do navegador ou abra a página como app pela tela de início, se disponível.",
      );
    }
  }

  return (
    <div
      className={`device-fullscreen${floating ? " floating" : ""}${dark ? " dark" : ""}`}
    >
      <button
        className="device-fullscreen-button"
        type="button"
        title={label}
        aria-label={label}
        onClick={() => void toggle()}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path
            d={
              fullscreen
                ? "M9 3v6H3m12-6v6h6M3 15h6v6m12-6h-6v6"
                : "M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6"
            }
          />
        </svg>
      </button>
      {notice && (
        <p className="device-fullscreen-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
