interface SpeakOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
  preferredLocales?: string[];
  onEnd?: () => void;
}

let cachedPreferredVoice: SpeechSynthesisVoice | null = null;

const resolvePreferredVoice = (preferredLocales?: string[]) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    return cachedPreferredVoice;
  }

  const preferences = preferredLocales && preferredLocales.length ? preferredLocales : ["en-GB", "en-US", "en-AU"];

  for (const locale of preferences) {
    const match = voices.find(voice => voice.lang?.toLowerCase().includes(locale.toLowerCase()));
    if (match) {
      cachedPreferredVoice = match;
      return match;
    }
  }

  if (!cachedPreferredVoice && voices.length) {
    cachedPreferredVoice = voices[0];
  }

  return cachedPreferredVoice;
};

export const speak = (text: string, options: SpeakOptions = {}) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = options.voice ?? resolvePreferredVoice(options.preferredLocales);
    if (voice) {
      utterance.voice = voice;
    }
    if (options.rate) {
      utterance.rate = options.rate;
    }
    if (options.pitch) {
      utterance.pitch = options.pitch;
    }
    if (options.volume) {
      utterance.volume = options.volume;
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
