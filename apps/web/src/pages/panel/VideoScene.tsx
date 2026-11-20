import { useCallback, useEffect, useRef, useState } from "react";
import type { PanelScene } from "@beend/shared";

export function VideoScene({
  scene,
  paused,
  onFinish,
}: {
  scene: PanelScene;
  paused: boolean;
  onFinish: () => void;
}) {
  const player = useRef<HTMLVideoElement>(null);
  const finished = useRef(false);
  const [showText, setShowText] = useState(false);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onFinish();
  }, [onFinish]);

  useEffect(() => {
    const video = player.current;
    if (!video) return;
    if (paused) {
      video.pause();
      return;
    }
    let active = true;
    let previousTime = video.currentTime;
    let stalled = 0;
    void video.play().catch(() => {
      if (active) finish();
    });
    const watchdog = window.setInterval(() => {
      const time = video.currentTime;
      stalled = time > previousTime ? 0 : stalled + 1;
      previousTime = time;
      if (stalled >= 2) finish();
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(watchdog);
      video.pause();
    };
  }, [paused, finish]);

  return (
    <section className="tv-card tv-scene" aria-label={scene.label}>
      <video
        ref={player}
        src={scene.videoUrl}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        onEnded={finish}
        onError={finish}
        onTimeUpdate={(event) => {
          if (!showText && event.currentTarget.currentTime >= 2.5)
            setShowText(true);
        }}
      />
      {showText && (
        <div className="tv-card-copy tv-scene-copy">
          <h2>{scene.title}</h2>
          <p>{scene.text}</p>
        </div>
      )}
      <p className="tv-photo-credit">
        <a href={scene.sourceUrl} target="_blank" rel="noreferrer">
          {scene.author} · Wikimedia Commons
        </a>
        {" · "}
        <a href={scene.licenseUrl} target="_blank" rel="noreferrer">
          {scene.license}
        </a>
        {" · Exibição sem áudio"}
      </p>
    </section>
  );
}
