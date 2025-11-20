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

  if (preferredLocales && preferredLocales.length) {
    for (const locale of preferredLocales) {
      const match = voices.find(voice => voice.lang?.toLowerCase().includes(locale.toLowerCase()));
      if (match) {
        cachedPreferredVoice = match;
        return match;
      }
    }
  }

  // 专门为小朋友选择友好的男声，按优先级排序
  const kidFriendlyVoices = [
    "Google US English Male",        // Google男声，清晰友好
    "Microsoft David Desktop",      // 微软男声，适合儿童
    "Microsoft Mark Desktop",       // 微软男声，很清晰
    "Alex",                         // macOS男声，温暖友好
    "Daniel",                       // 英式男声，温和
    "Aaron",                        // Windows男声
    "Tyler",                        // 美式男声
    "Fred",                         // 简单男声
    "Microsoft Mike Desktop",       // 经典微软男声
    "Google UK English Male",        // 英式Google男声
  ];

  // 优先选择专门适合儿童的声音
  for (const voiceName of kidFriendlyVoices) {
    const match = voices.find(voice =>
      voice.name === voiceName &&
      (voice.lang.includes('en') || voice.lang.includes('EN'))
    );
    if (match) {
      cachedPreferredVoice = match;
      return match;
    }
  }

  // 如果没有找到特定声音，查找男性声音
  const maleVoices = voices.filter(voice =>
    voice.lang.includes('en') && (
      voice.name.includes('Male') ||
      voice.name.includes('Man') ||
      voice.name.includes('Boy') ||
      voice.name.toLowerCase().includes('alex') ||
      voice.name.toLowerCase().includes('david') ||
      voice.name.toLowerCase().includes('mark') ||
      voice.name.toLowerCase().includes('daniel') ||
      voice.name.toLowerCase().includes('aaron') ||
      voice.name.toLowerCase().includes('tyler') ||
      voice.name.toLowerCase().includes('fred')
    )
  );

  if (maleVoices.length > 0) {
    cachedPreferredVoice = maleVoices[0];
    return maleVoices[0];
  }

  // 最后按地区查找美式英语（最通用）
  const preferences = ["en-US", "en-GB", "en-AU"];
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

    // 为小朋友设置适合男声的朗读参数
    // 语速适中，便于孩子理解
    utterance.rate = options.rate ?? 0.9;

    // 男声音调适中，不要太低也不要太高
    utterance.pitch = options.pitch ?? 0.95;

    // 音量适中，保护听力
    utterance.volume = options.volume ?? 0.8;

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
