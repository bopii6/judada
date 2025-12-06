import { useEffect, useState } from "react";
import { speak, useVoices, VOICE_KEY } from "../hooks/useTTS";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { Moon, Sun, Volume2, Play, Check, ChevronDown, Palette, Mic, Shield, User, KeyRound, Smartphone, Mail } from "lucide-react";
import classNames from "classnames";

export const Settings = () => {
  const voices = useVoices();
  const { theme, setTheme } = useTheme();
  const { user, getUserDisplayName, getUserAvatar } = useAuth();
  const [voiceUri, setVoiceUri] = useState<string | null>(() => localStorage.getItem(VOICE_KEY));
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (voiceUri) {
      localStorage.setItem(VOICE_KEY, voiceUri);
    }
  }, [voiceUri]);

  const previewVoice = () => {
    const voice = voices.find(item => item.voiceURI === voiceUri);
    setIsPlaying(true);
    speak("Hello, let's practice English together!", { voice });
    setTimeout(() => setIsPlaying(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-orange-500/30 pb-20">
      {/* Abstract Background Shapes */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl translate-y-1/2" />
      </div>

      <div className="relative max-w-4xl mx-auto space-y-8 pt-8 px-4">

        {/* Account Section */}
        <section className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:bg-white/80 dark:hover:bg-slate-900/60 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">账户信息</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                管理你的个人资料和账户设置
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full p-1 bg-white dark:bg-slate-800 shadow-lg ring-1 ring-slate-100 dark:ring-slate-700">
                <img
                  src={getUserAvatar()}
                  alt={getUserDisplayName()}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <button className="absolute bottom-0 right-0 p-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg hover:scale-110 transition-transform">
                <Palette className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1 w-full space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">昵称</label>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-bold text-slate-700 dark:text-slate-200">{getUserDisplayName()}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">邮箱</label>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="font-bold text-slate-700 dark:text-slate-200">{user?.email ?? "user@example.com"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Theme Section */}
        <section className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:bg-white/80 dark:hover:bg-slate-900/60 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">界面主题</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                选择你喜欢的界面外观模式
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md">
            <button
              onClick={() => setTheme('light')}
              className={classNames(
                "relative group p-4 rounded-2xl border-2 transition-all duration-200 text-left",
                theme === 'light'
                  ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10"
                  : "border-slate-200 dark:border-slate-700 hover:border-orange-200 dark:hover:border-orange-800 bg-white dark:bg-slate-800"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-amber-500 ring-1 ring-slate-100">
                  <Sun className="w-4 h-4" />
                </div>
                {theme === 'light' && <Check className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
              </div>
              <div className="font-bold text-slate-900 dark:text-white">浅色模式</div>
              <div className="text-xs text-slate-500 mt-1">清晰明亮</div>
            </button>

            <button
              onClick={() => setTheme('dark')}
              className={classNames(
                "relative group p-4 rounded-2xl border-2 transition-all duration-200 text-left",
                theme === 'dark'
                  ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10"
                  : "border-slate-200 dark:border-slate-700 hover:border-orange-200 dark:hover:border-orange-800 bg-white dark:bg-slate-800"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-orange-400 ring-1 ring-slate-700">
                  <Moon className="w-4 h-4" />
                </div>
                {theme === 'dark' && <Check className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
              </div>
              <div className="font-bold text-slate-900 dark:text-white">深色模式</div>
              <div className="text-xs text-slate-500 mt-1">护眼舒适</div>
            </button>
          </div>
        </section>

        {/* Voice Section */}
        <section className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:bg-white/80 dark:hover:bg-slate-900/60 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 flex items-center justify-center">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">语音设置</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                选择朗读课程内容的语音引擎
              </p>
            </div>
          </div>

          <div className="max-w-md space-y-4">
            <div className="relative">
              <select
                className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
                value={voiceUri ?? ''}
                onChange={event => setVoiceUri(event.target.value || null)}
              >
                <option value="">系统默认语音</option>
                {voices.map(voice => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
              <Volume2 className="w-3 h-3" />
              <span>若列表为空，请在系统设置中添加英语语音包</span>
            </div>

            <button
              onClick={previewVoice}
              disabled={isPlaying}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-200 dark:shadow-none"
            >
              {isPlaying ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                  </span>
                  播放中...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  试听语音
                </>
              )}
            </button>
          </div>
        </section>

        {/* Security Section */}
        <section className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:bg-white/80 dark:hover:bg-slate-900/60 animate-in fade-in slide-in-from-bottom-7 duration-700 delay-300">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">安全设置</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                管理账户安全，保护你的隐私
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <button className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 hover:shadow-md transition-all group text-left">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 transition-colors">
                  <KeyRound className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">修改密码</div>
                  <div className="text-xs text-slate-500 mt-0.5">定期修改密码以保护账号</div>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all">
                <ChevronDown className="w-5 h-5 -rotate-90" />
              </div>
            </button>

            <button className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 hover:shadow-md transition-all group text-left">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 transition-colors">
                  <Smartphone className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">绑定手机</div>
                  <div className="text-xs text-slate-500 mt-0.5">已绑定：138****8888</div>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all">
                <ChevronDown className="w-5 h-5 -rotate-90" />
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

