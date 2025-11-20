declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

let audioContext: AudioContext | null = null;

const getContext = () => {
  if (typeof window === "undefined") {
    return null;
  }
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    audioContext = new AudioCtx();
  }
  return audioContext;
};

const playTone = (frequency: number, duration = 0.2, type: OscillatorType = "sine") => {
  const ctx = getContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

  oscillator.start(now);
  oscillator.stop(now + duration + 0.05);
};

export const playClickSound = () => {
  playTone(520, 0.12, "triangle");
};

export const playSuccessSound = () => {
  playTone(660, 0.18, "sine");
  setTimeout(() => playTone(880, 0.18, "sine"), 90);
};

export const playErrorSound = () => {
  playTone(220, 0.12, "sawtooth");
  setTimeout(() => playTone(180, 0.18, "sawtooth"), 120);
};
