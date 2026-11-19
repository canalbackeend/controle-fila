export function playAlert(audio: AudioContext) {
  if (audio.state !== "running") return;
  const when = audio.currentTime;
  [660, 990].forEach((frequency, index) => {
    const wave = audio.createOscillator();
    const volume = audio.createGain();
    const start = when + index * 0.15;
    wave.type = "sine";
    wave.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(0.001, start);
    volume.gain.exponentialRampToValueAtTime(0.22, start + 0.025);
    volume.gain.exponentialRampToValueAtTime(0.001, start + 0.47);
    wave.connect(volume).connect(audio.destination);
    wave.onended = () => {
      wave.disconnect();
      volume.disconnect();
    };
    wave.start(start);
    wave.stop(start + 0.5);
  });
}
