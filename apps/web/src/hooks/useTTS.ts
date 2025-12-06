import { useEffect, useState } from "react";

interface SpeakOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
  preferredLocales?: string[];
  onEnd?: () => void;
}

export const VOICE_KEY = "judada:voice";
const DEFAULT_SPEECH_VOLUME = 1;

const ALLOWED_VOICE_URIS = new Set([
  "Google US English",
  "Google UK English Female",
  "Google UK English Male",
  "Google español",
]);

let cachedPreferredVoice: SpeechSynthesisVoice | null = null;
let cachedPreferredVoiceId: string | null = null;

const getAllVoices = () => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [] as SpeechSynthesisVoice[];
  }
  return window.speechSynthesis.getVoices();
};

const filterAllowedVoices = (voices: SpeechSynthesisVoice[]) =>
  voices.filter(
    voice => ALLOWED_VOICE_URIS.has(voice.voiceURI) || ALLOWED_VOICE_URIS.has(voice.name),
  );

const getSelectableVoices = () => {
  const voices = getAllVoices();
  const allowed = filterAllowedVoices(voices);
  return allowed.length ? allowed : voices;
};

const getStoredVoiceUri = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
};

const persistVoiceIfMissing = (voice: SpeechSynthesisVoice | null) => {
  if (!voice || typeof window === "undefined") {
    return;
  }
  try {
    if (!window.localStorage.getItem(VOICE_KEY)) {
      window.localStorage.setItem(VOICE_KEY, voice.voiceURI);
    }
  } catch {
    // ignore persistence errors
  }
};

const rememberVoice = (voice: SpeechSynthesisVoice | null, { persist = true } = {}) => {
  if (!voice) {
    return null;
  }
  cachedPreferredVoice = voice;
  cachedPreferredVoiceId = voice.voiceURI ?? voice.name;
  if (persist) {
    persistVoiceIfMissing(voice);
  }
  return voice;
};

const resolveStoredVoice = (voices: SpeechSynthesisVoice[]) => {
  const savedVoiceUri = getStoredVoiceUri();
  if (!savedVoiceUri) {
    return null;
  }
  return (
    voices.find(voice => voice.voiceURI === savedVoiceUri || voice.name === savedVoiceUri) ??
    null
  );
};

const resolveCachedVoice = (voices: SpeechSynthesisVoice[]) => {
  if (!cachedPreferredVoiceId) {
    return null;
  }
  return (
    voices.find(
      voice => voice.voiceURI === cachedPreferredVoiceId || voice.name === cachedPreferredVoiceId,
    ) ?? null
  );
};

const resolvePreferredVoice = (preferredLocales?: string[]) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const voices = getSelectableVoices();
  if (!voices.length) {
    return cachedPreferredVoice;
  }

  const storedVoice = resolveStoredVoice(voices);
  if (storedVoice) {
    return rememberVoice(storedVoice, { persist: false });
  }

  const cachedVoice = resolveCachedVoice(voices);
  if (cachedVoice) {
    return rememberVoice(cachedVoice, { persist: false });
  }

  if (preferredLocales && preferredLocales.length) {
    for (const locale of preferredLocales) {
      const match = voices.find(voice => voice.lang?.toLowerCase().includes(locale.toLowerCase()));
      if (match) {
        return rememberVoice(match);
      }
    }
  }

  // 专门为小朋友选择友好的男声，按优先级排序
  const kidFriendlyVoices = [
    "Google US English Male", // Google男声，清晰友好
    "Microsoft David Desktop", // 微软男声，适合儿童
    "Microsoft Mark Desktop", // 微软男声，很清晰
    "Alex", // macOS男声，温暖友好
    "Daniel", // 英式男声，温和
    "Aaron", // Windows男声
    "Tyler", // 美式男声
    "Fred", // 简单男声
    "Microsoft Mike Desktop", // 经典微软男声
    "Google UK English Male", // 英式Google男声
  ];

  // 优先选择专门适合儿童的声音
  for (const voiceName of kidFriendlyVoices) {
    const match = voices.find(
      voice =>
        voice.name === voiceName && (voice.lang.includes("en") || voice.lang.includes("EN")),
    );
    if (match) {
      return rememberVoice(match);
    }
  }

  // 如果没有找到特定声音，查找男性声音
  const maleVoices = voices.filter(
    voice =>
      voice.lang.includes("en") &&
      (voice.name.includes("Male") ||
        voice.name.includes("Man") ||
        voice.name.includes("Boy") ||
        voice.name.toLowerCase().includes("alex") ||
        voice.name.toLowerCase().includes("david") ||
        voice.name.toLowerCase().includes("mark") ||
        voice.name.toLowerCase().includes("daniel") ||
        voice.name.toLowerCase().includes("aaron") ||
        voice.name.toLowerCase().includes("tyler") ||
        voice.name.toLowerCase().includes("fred")),
  );

  if (maleVoices.length > 0) {
    return rememberVoice(maleVoices[0]);
  }

  // 最后按地区查找美式英语（最通用）
  const preferences = ["en-US", "en-GB", "en-AU"];
  for (const locale of preferences) {
    const match = voices.find(voice => voice.lang?.toLowerCase().includes(locale.toLowerCase()));
    if (match) {
      return rememberVoice(match);
    }
  }

  if (voices.length) {
    return rememberVoice(voices[0]);
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

    // 为小朋友设置适合男声的朗读参数
    // 语速适中，便于孩子理解
    utterance.rate = options.rate ?? 0.9;

    // 男声音调适中，不要太低也不要太高
    utterance.pitch = options.pitch ?? 0.95;

    // 默认保持系统音量，如有需要再通过 options.volume 调整
    utterance.volume = options.volume ?? DEFAULT_SPEECH_VOLUME;

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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoices([]);
      return;
    }

    const updateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      setVoices(filterAllowedVoices(allVoices));
    };

    updateVoices();
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
    };
  }, []);

  return voices;
};
