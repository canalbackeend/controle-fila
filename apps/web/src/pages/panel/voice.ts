import type { PanelCall } from "@beend/shared";

const letters: Record<string, string> = {
  A: "a",
  B: "bê",
  C: "cê",
  D: "dê",
  E: "é",
  F: "efe",
  G: "gê",
  H: "agá",
  I: "i",
  J: "jota",
  K: "cá",
  L: "ele",
  M: "eme",
  N: "ene",
  O: "ó",
  P: "pê",
  Q: "quê",
  R: "erre",
  S: "esse",
  T: "tê",
  U: "u",
  V: "vê",
  W: "dáblio",
  X: "xis",
  Y: "ípsilon",
  Z: "zê",
};
const digits = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
];

function spell(code: string) {
  return [...code.toUpperCase()]
    .map((char) => letters[char] ?? digits[Number(char)] ?? char)
    .join(", ");
}

export function callAnnouncement(
  call: Pick<PanelCall, "code" | "counter" | "displayName">,
) {
  const counter = /^\d+$/.test(call.counter.trim())
    ? `Guichê ${call.counter.trim()}`
    : call.counter.trim();
  const who = call.displayName ?? `Senha: ${spell(call.code)}.`;
  return `${who} ${counter}.`;
}

type Voice = Pick<SpeechSynthesisVoice, "lang">;

export function pickVoice<T extends Voice>(voices: readonly T[]) {
  const language = (voice: T) => voice.lang.replace("_", "-").toLowerCase();
  return (
    voices.find((voice) => language(voice) === "pt-br") ??
    voices.find((voice) => language(voice).startsWith("pt"))
  );
}

function synthesis() {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : undefined;
}

/** Called from the "Toque para iniciar" gesture so the browser allows speech later. */
export function unlockSpeech() {
  const speech = synthesis();
  if (!speech) return;
  speech.getVoices();
  const silent = new SpeechSynthesisUtterance("");
  silent.volume = 0;
  speech.speak(silent);
}

/** Speaks the call and returns false when no Portuguese voice is available. */
export function speakCall(
  call: Pick<PanelCall, "code" | "counter" | "displayName">,
) {
  const speech = synthesis();
  const voice = speech && pickVoice(speech.getVoices());
  if (!speech || !voice) return false;
  speech.cancel();
  const utterance = new SpeechSynthesisUtterance(callAnnouncement(call));
  utterance.voice = voice;
  utterance.lang = "pt-BR";
  utterance.rate = 0.9;
  speech.speak(utterance);
  return true;
}

export function stopSpeech() {
  synthesis()?.cancel();
}
