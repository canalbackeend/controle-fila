const storageKey = "beend-chunk-reload";
const retryWindow = 60_000;

type Dependencies = {
  target: {
    addEventListener: (type: string, handler: (event: Event) => void) => void;
  };
  storage: Pick<Storage, "getItem" | "setItem">;
  reload: () => void;
  now: () => number;
};

/**
 * After a deploy, a tab opened on the previous version may request page files
 * that no longer exist. Reload once so the browser picks up the new version.
 * A second failure within a minute is left to the error screen to avoid loops.
 */
export function installChunkRecovery(
  dependencies: Dependencies = {
    target: window,
    storage: window.sessionStorage,
    reload: () => window.location.reload(),
    now: () => Date.now(),
  },
) {
  const { target, storage, reload, now } = dependencies;
  target.addEventListener("vite:preloadError", () => {
    const current = now();
    let last = 0;
    try {
      last = Number(storage.getItem(storageKey)) || 0;
    } catch {
      /* Without storage the first reload still helps. */
    }
    if (last && current - last < retryWindow) return;
    try {
      storage.setItem(storageKey, String(current));
    } catch {
      /* Reload anyway. */
    }
    reload();
  });
}
