import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface SpeakConfig {
  text: string;
  voiceURI?: string;
  rate?: number;
}

export function useTTS() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ready, setReady] = useState(false);
  const supportRef = useRef(typeof window !== 'undefined' && 'speechSynthesis' in window);

  useEffect(() => {
    if (!supportRef.current) return;

    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length > 0) {
        setVoices(list);
        setReady(true);
      }
    };

    loadVoices();

    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  const speak = useCallback(
    ({ text, voiceURI, rate = 1 }: SpeakConfig) => {
      if (!supportRef.current || !text) return;
      const utterance = new SpeechSynthesisUtterance(text);
      if (voiceURI) {
        const selected = voices.find(v => v.voiceURI === voiceURI);
        if (selected) {
          utterance.voice = selected;
        }
      } else {
        const fallback = voices.find(v => v.lang.startsWith('en')) ?? voices[0];
        if (fallback) {
          utterance.voice = fallback;
        }
      }
      utterance.rate = rate;
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } catch {
        /* noop */
      }
    },
    [voices]
  );

  const cancel = useCallback(() => {
    if (!supportRef.current) return;
    window.speechSynthesis.cancel();
  }, []);

  const unlock = useCallback(() => {
    if (!supportRef.current) return;
    try {
      window.speechSynthesis.resume();
    } catch {
      /* noop */
    }
  }, []);

  const englishVoices = useMemo(
    () => voices.filter(voice => voice.lang.toLowerCase().startsWith('en')),
    [voices]
  );

  return {
    supported: supportRef.current,
    ready,
    voices,
    englishVoices,
    speak,
    cancel,
    unlock
  };
}
