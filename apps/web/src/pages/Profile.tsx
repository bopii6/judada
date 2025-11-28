import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { User, KeyRound, Crown, Save, Camera } from "lucide-react";

export const Profile: React.FC = () => {
  const { user, updateProfile, setPasswordForEmail } = useAuth();
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
        <h1 className="text-3xl font-black text-slate-800">个人资料</h1>
        <p className="text-slate-500 font-medium">管理你的账户信息和安全设置。</p>
      </div>

      {(status || error) && (
        <div className={`rounded-2xl px-6 py-4 font-bold animate-in fade-in slide-in-from-top-2 ${error ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"}`}>
          {error || status}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-[1fr_1.5fr]">
        {/* Left Column: Avatar & Basic Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 text-center">
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
            <h2 className="text-xl font-bold text-slate-800">{nickname || "未设置昵称"}</h2>
            <p className="text-sm text-slate-400 font-medium mt-1">{user?.email}</p>
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl p-8 shadow-lg text-white relative overflow-hidden">
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
          <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-blue-100 text-blue-500">
                <User className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">基本信息</h3>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">昵称</label>
                <input
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  className="block w-full px-6 py-3 bg-slate-50 border border-slate-200 rounded-full text-slate-800 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold"
                  placeholder="给自己起个好听的名字"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">头像链接</label>
                <input
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  className="block w-full px-6 py-3 bg-slate-50 border border-slate-200 rounded-full text-slate-800 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-sm"
                  placeholder="https://..."
                />
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  className="flex items-center gap-2 px-8 py-3 rounded-full bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                >
                  <Save className="w-4 h-4" />
                  保存修改
                </button>
              </div>
            </div>
          </div>

          {/* Password Form */}
          <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-500">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">安全设置</h3>
            </div>

            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">新密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="block w-full px-6 py-3 bg-slate-50 border border-slate-200 rounded-full text-slate-800 focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition-all font-bold"
                    placeholder="至少 6 位"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">确认密码</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="block w-full px-6 py-3 bg-slate-50 border border-slate-200 rounded-full text-slate-800 focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition-all font-bold"
                    placeholder="再次输入"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSetPassword}
                  className="flex items-center gap-2 px-8 py-3 rounded-full bg-white border border-slate-200 text-slate-700 font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors shadow-sm"
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
