import { useEffect, useState } from "react";
import { speak, useVoices } from "../hooks/useTTS";

const THEME_KEY = "judada:theme";
const VOICE_KEY = "judada:voice";

export const Settings = () => {
  const voices = useVoices();
  const [theme, setTheme] = useState<string>(() => localStorage.getItem(THEME_KEY) ?? "light");
  const [voiceUri, setVoiceUri] = useState<string | null>(() => localStorage.getItem(VOICE_KEY));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (voiceUri) {
      localStorage.setItem(VOICE_KEY, voiceUri);
    }
  }, [voiceUri]);

  const previewVoice = () => {
    const voice = voices.find(item => item.voiceURI === voiceUri);
    speak("Hello, let's practice English together!", { voice });
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-slate-900">设置</h1>
        <p className="mt-2 text-sm text-slate-500">调整外观与语音偏好，让练习体验更加贴合孩子的节奏。</p>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">主题</h2>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm ${theme === 'light' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
            onClick={() => setTheme('light')}
          >
            浅色
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm ${theme === 'dark' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
            onClick={() => setTheme('dark')}
          >
            深色
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">语音设置</h2>
        <p className="mt-2 text-sm text-slate-500">使用浏览器内置的语音朗读功能。若列表为空，请在浏览器设置中安装英文语音包。</p>
        <select
          className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={voiceUri ?? ''}
          onChange={event => setVoiceUri(event.target.value || null)}
        >
          <option value="">系统默认</option>
          {voices.map(voice => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.name} ({voice.lang})
            </option>
          ))}
        </select>
        <button type="button" className="mt-3 text-sm text-blue-600 hover:underline" onClick={previewVoice}>
          试听
        </button>
      </section>
    </div>
  );
};
