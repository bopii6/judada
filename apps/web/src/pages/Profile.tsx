import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";

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
    } catch (err: any) {
      setError(err?.message || "设置密码失败");
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setStatus("已为该邮箱设置登录密码，下次可用邮箱+密码登录");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">个人资料</h1>
        <p className="text-sm text-slate-600 mt-1">更新头像、昵称，或为邮箱账号设置登录密码。</p>
      </div>

      {(status || error) && (
        <div className={`rounded-lg px-4 py-3 ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {error || status}
        </div>
      )}

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 p-6 space-y-6">
        <div className="flex items-center space-x-4">
          <img
            src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname || user?.email || "User")}`}
            alt="头像预览"
            className="w-16 h-16 rounded-full object-cover border border-slate-200"
          />
          <div className="flex-1 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">昵称</label>
              <input
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                placeholder="输入昵称"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">头像地址</label>
              <input
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                placeholder="可填网络图片地址"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSaveProfile}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            保存资料
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">邮箱登录密码</h2>
          <p className="text-sm text-slate-600">
            当前登录邮箱：{user?.email || "（未使用邮箱登录）"}。设置密码后，可用“邮箱 + 密码”直接登录。
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">新密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
              placeholder="至少 6 位"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
              placeholder="再次输入密码"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSetPassword}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            设置密码
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">会员权益（预告）</h2>
        <p className="text-sm text-slate-600">
          将来这里会提供会员购买与权益管理，当前仅展示入口，功能暂未开放。
        </p>
      </div>
    </div>
  );
};
