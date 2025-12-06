import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../contexts/ThemeContext";
import { useSoundEffect } from "../contexts/SoundEffectContext";
import { speak, useVoices, VOICE_KEY } from "../hooks/useTTS";
import {
  User, KeyRound, Save, Camera, Sun, Moon, Palette, Volume2,
  Check, Shield, Headphones, AlertCircle
} from "lucide-react";
import classNames from "classnames";

export const Profile: React.FC = () => {
  const { user, updateProfile, setPasswordForEmail } = useAuth();
  const { theme, setTheme } = useTheme();
  const { soundMode, setSoundMode, playClickSound } = useSoundEffect();
  const voices = useVoices();

  const [nickname, setNickname] = useState(user?.nickname || user?.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [voiceUri, setVoiceUri] = useState<string | null>(() => localStorage.getItem(VOICE_KEY));
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (voiceUri) {
      localStorage.setItem(VOICE_KEY, voiceUri);
    }
  }, [voiceUri]);

  const previewVoice = () => {
    const voice = voices.find(item => item.voiceURI === voiceUri);
    speak("Hello, let's practice English together!", { voice });
  };

  const handleSaveProfile = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await updateProfile({ nickname: nickname.trim(), avatarUrl: avatarUrl.trim() || undefined });
      setStatus("资料已更新");
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setError("更新失败，请稍后重试");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPassword = async () => {
    setError(null);
    setStatus(null);
    if (!user?.email) {
      setError("当前登录方式不支持设置密码（需要邮箱登录）");
      return;
    }
    if (!password || password.length < 6) {
      setError("密码长度至少 6 位");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    try {
      await setPasswordForEmail(user.email, password);
    } catch (err: unknown) {
      const fallbackMessage = "设置密码失败，请稍后重试";
      if (err instanceof Error) {
        setError(err.message || fallbackMessage);
      } else {
        setError(fallbackMessage);
      }
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setStatus("已为该邮箱设置登录密码，下次可用邮箱+密码登录");
    setTimeout(() => setStatus(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-orange-500/30 pb-20">
      {/* Abstract Background Shapes */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl translate-y-1/2" />
      </div>

      {/* Status Messages */}
      {(status || error) && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4 max-w-md w-full mx-4 ${error
            ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-800"
            : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-200 dark:border-emerald-800"
          }`}>
          <div className="flex items-center gap-3">
            {error ? (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Check className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="font-bold text-sm">{error || status}</p>
          </div>
        </div>
      )}

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

          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="relative group mx-auto md:mx-0">
              <div className="w-32 h-32 rounded-full p-1 bg-white dark:bg-slate-800 shadow-lg ring-1 ring-slate-100 dark:ring-slate-700 overflow-hidden">
                <img
                  src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname || user?.email || "User")}&background=6366f1&color=fff&size=256`}
                  alt="头像预览"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <div className="absolute bottom-0 right-0 p-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg">
                <Camera className="w-4 h-4" />
              </div>
            </div>

            <div className="flex-1 w-full space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">昵称</label>
                  <input
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    className="block w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 transition-all font-medium"
                    placeholder="给自己起个好听的名字"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">头像链接</label>
                  <input
                    value={avatarUrl}
                    onChange={e => setAvatarUrl(e.target.value)}
                    className="block w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 transition-all font-medium text-sm"
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-200 dark:shadow-none"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>保存中...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>保存修改</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Appearance Section */}
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

        {/* Audio Section */}
        <section className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:bg-white/80 dark:hover:bg-slate-900/60 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 flex items-center justify-center">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">音频设置</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                自定义音效和语音朗读偏好
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">音效模式</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { value: 'telegraph' as const, label: '电报机' },
                  { value: 'classic' as const, label: '经典' },
                  { value: 'minimal' as const, label: '极简' },
                  { value: 'off' as const, label: '关闭' }
                ].map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => {
                      setSoundMode(mode.value);
                      if (mode.value !== 'off') {
                        setTimeout(() => playClickSound(), 100);
                      }
                    }}
                    className={classNames(
                      "px-4 py-3 rounded-xl border text-sm font-bold transition-all",
                      soundMode === mode.value
                        ? "bg-pink-50 dark:bg-pink-900/20 border-pink-500 text-pink-600 dark:text-pink-400"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-pink-200"
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">语音朗读</label>
              <div className="max-w-md relative">
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
                <button
                  onClick={previewVoice}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-orange-500 transition-colors"
                  title="试听语音"
                >
                  <Headphones className="w-4 h-4" />
                </button>
              </div>
            </div>
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

          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">新密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="block w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/10 transition-all font-medium"
                  placeholder="至少 6 位"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">确认密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="block w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/10 transition-all font-medium"
                  placeholder="再次输入"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={handleSetPassword}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
              >
                <KeyRound className="w-4 h-4" />
                <span>设置密码</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

