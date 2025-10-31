interface SpeakOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  onEnd?: () => void;
}

export const speak = (text: string, options: SpeakOptions = {}) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (options.voice) {
      utterance.voice = options.voice;
    }
    if (options.rate) {
      utterance.rate = options.rate;
    }
    if (options.onEnd) {
      utterance.onend = options.onEnd;
    }
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("speechSynthesis unavailable", error);
  }
};

export const useVoices = () => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [] as SpeechSynthesisVoice[];
  }
  return window.speechSynthesis.getVoices();
};
