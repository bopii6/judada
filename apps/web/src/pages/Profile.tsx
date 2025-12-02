import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../contexts/ThemeContext";
import { User, KeyRound, Crown, Save, Camera, Sun, Moon, Palette } from "lucide-react";

export const Profile: React.FC = () => {
  const { user, updateProfile, setPasswordForEmail } = useAuth();
  const { theme, toggleTheme, setTheme } = useTheme();
  const [nickname, setNickname] = useState(user?.nickname || user?.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSaveProfile = () => {
    setError(null);
    updateProfile({ nickname: nickname.trim(), avatarUrl: avatarUrl.trim() || undefined });
    setStatus("资料已更新");
    setTimeout(() => setStatus(null), 3000);
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
      const fallbackMessage = "???????????";
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
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100">设置</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">管理你的账户信息、主题和安全设置。</p>
      </div>

      {(status || error) && (
        <div className={`rounded-2xl px-6 py-4 font-bold animate-in fade-in slide-in-from-top-2 ${
          error 
            ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800" 
            : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800"
        }`}>
          {error || status}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-[1fr_1.5fr]">
        {/* Left Column: Avatar & Basic Info */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 text-center">
            <div className="relative inline-block mb-6">
              <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-orange-300 to-pink-300">
                <img
                  src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname || user?.email || "User")}`}
                  alt="头像预览"
                  className="w-full h-full rounded-full object-cover border-4 border-white bg-white"
                />
              </div>
              <div className="absolute bottom-0 right-0 p-2 bg-slate-800 text-white rounded-full shadow-lg border-4 border-white">
                <Camera className="w-4 h-4" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{nickname || "未设置昵称"}</h2>
            <p className="text-sm text-slate-400 dark:text-slate-500 font-medium mt-1">{user?.email}</p>
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 dark:from-indigo-600 dark:to-violet-700 rounded-3xl p-8 shadow-lg text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/20 rounded-full blur-2xl"></div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur">
                <Crown className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg">会员权益</h3>
            </div>
            <p className="text-indigo-100 text-sm leading-relaxed mb-6">
              升级会员解锁无限关卡、专属词库和 AI 口语教练。
            </p>
            <button className="w-full py-3 rounded-xl bg-white text-indigo-600 font-bold text-sm hover:bg-indigo-50 transition-colors">
              即将上线
            </button>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div className="space-y-6">
          {/* Profile Form */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400">
                <User className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">基本信息</h3>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">昵称</label>
                <input
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  className="block w-full px-6 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-600 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold"
                  placeholder="给自己起个好听的名字"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">头像链接</label>
                <input
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  className="block w-full px-6 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-600 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-sm"
                  placeholder="https://..."
                />
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  className="flex items-center gap-2 px-8 py-3 rounded-full bg-slate-900 dark:bg-slate-700 text-white dark:text-slate-100 font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors shadow-lg shadow-slate-900/20 dark:shadow-slate-900/40"
                >
                  <Save className="w-4 h-4" />
                  保存修改
                </button>
              </div>
            </div>
          </div>

          {/* Theme Settings */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-500 dark:text-purple-400">
                <Palette className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">主题设置</h3>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 ml-1">
                  选择主题
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setTheme("light")}
                    className={`group relative p-6 rounded-2xl border-2 transition-all ${
                      theme === "light"
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className={`p-3 rounded-xl ${
                        theme === "light"
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
                      }`}>
                        <Sun className="w-6 h-6" />
                      </div>
                      <span className={`text-sm font-bold ${
                        theme === "light"
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-slate-700 dark:text-slate-300"
                      }`}>
                        浅色模式
                      </span>
                    </div>
                    {theme === "light" && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </button>

                  <button
                    onClick={() => setTheme("dark")}
                    className={`group relative p-6 rounded-2xl border-2 transition-all ${
                      theme === "dark"
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className={`p-3 rounded-xl ${
                        theme === "dark"
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
                      }`}>
                        <Moon className="w-6 h-6" />
                      </div>
                      <span className={`text-sm font-bold ${
                        theme === "dark"
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-slate-700 dark:text-slate-300"
                      }`}>
                        深色模式
                      </span>
                    </div>
                    {theme === "dark" && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={toggleTheme}
                  className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-full bg-slate-900 dark:bg-slate-700 text-white dark:text-slate-100 font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors shadow-lg shadow-slate-900/20 dark:shadow-slate-900/40"
                >
                  {theme === "light" ? (
                    <>
                      <Moon className="w-4 h-4" />
                      <span>切换到深色模式</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-4 h-4" />
                      <span>切换到浅色模式</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Password Form */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">安全设置</h3>
            </div>

            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">新密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="block w-full px-6 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-600 focus:border-emerald-400 dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-bold"
                    placeholder="至少 6 位"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">确认密码</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="block w-full px-6 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-600 focus:border-emerald-400 dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-bold"
                    placeholder="再次输入"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSetPassword}
                  className="flex items-center gap-2 px-8 py-3 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-100 font-bold hover:border-emerald-400 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors shadow-sm"
                >
                  <KeyRound className="w-4 h-4" />
                  设置密码
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
