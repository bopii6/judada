import React from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Users, Target, Star, Mail, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { progressStore } from "../store/progressStore";

const features = [
  {
    icon: <BookOpen className="h-8 w-8 text-blue-600" />,
    title: "丰富的课程内容",
    description: "涵盖听说读写的全方位英语学习材料"
  },
  {
    icon: <Users className="h-8 w-8 text-emerald-600" />,
    title: "个性化学习路径",
    description: "根据你的水平定制专属学习计划"
  },
  {
    icon: <Target className="h-8 w-8 text-purple-600" />,
    title: "游戏化闯关",
    description: "通过趣味关卡提升学习兴趣"
  },
  {
    icon: <Star className="h-8 w-8 text-amber-500" />,
    title: "实时进度跟踪",
    description: "详细记录学习成果和成长轨迹"
  }
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithPassword } = useAuth();
  const [pwdEmail, setPwdEmail] = React.useState("");
  const [pwd, setPwd] = React.useState("");
  const [pwdError, setPwdError] = React.useState<string | null>(null);

  const handlePasswordLogin = async () => {
    setPwdError(null);
    try {
      await loginWithPassword(pwdEmail.trim(), pwd);
      try {
        progressStore.initializeForUser();
      } catch {}
      navigate("/", { replace: true });
    } catch (err: any) {
      setPwdError(err?.message || "登录失败，请检查邮箱与密码");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-12 items-center">
        {/* 左侧介绍 */}
        <div className="text-center lg:text-left space-y-6">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-indigo-600 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              数据安全 · 云端同步
            </p>
            <h1 className="mt-4 text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
              欢迎来到
              <span className="block text-indigo-600">Jude English Lab</span>
            </h1>
            <p className="text-lg text-slate-600 mt-3">专业的英语学习平台，让学习更高效、更有趣。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start space-x-4 rounded-2xl bg-white/80 px-4 py-3 shadow-sm">
                <div className="flex-shrink-0">{feature.icon}</div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">{feature.title}</h3>
                  <p className="text-sm text-slate-600">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-indigo-600">10,000+</div>
                <div className="text-sm text-slate-600">活跃学员</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">500+</div>
                <div className="text-sm text-slate-600">精品课程</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">4.8</div>
                <div className="text-sm text-slate-600">用户评分</div>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧登录卡片 */}
        <div className="bg-white/95 rounded-3xl shadow-xl p-8 border border-slate-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-full mb-4">
              <BookOpen className="h-8 w-8 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">选择登录方式</h2>
            <p className="text-sm text-slate-600">用邮箱登录即可同步进度，继续你的学习旅程。</p>
          </div>

          <div className="space-y-4">
            {/* 邮箱验证码登录 */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.4)]">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
                  <Mail className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="font-semibold text-slate-900 text-lg">邮箱验证码登录</span>
              </div>
              <p className="text-sm text-slate-600 mb-5">安全便捷，用邮箱验证码快速登录，无需记密码。</p>
              <button
                onClick={() => navigate("/email-login")}
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold shadow hover:from-emerald-600 hover:to-emerald-700 transition"
              >
                使用邮箱登录
              </button>
            </div>

            {/* 邮箱 + 密码登录 */}
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-6 shadow-[0_10px_30px_-18px_rgba(79,70,229,0.4)]">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                  <LockKeyhole className="h-5 w-5 text-indigo-600" />
                </div>
                <span className="font-semibold text-slate-900 text-lg">邮箱 + 密码登录</span>
              </div>
              <p className="text-sm text-slate-600 mb-4">已有密码？直接使用邮箱 + 密码登录。</p>
              <div className="space-y-3">
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="邮箱地址"
                  value={pwdEmail}
                  onChange={e => setPwdEmail(e.target.value)}
                />
                <input
                  type="password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="密码"
                  value={pwd}
                  onChange={e => setPwd(e.target.value)}
                />
                {pwdError && <div className="text-sm text-red-600">{pwdError}</div>}
                <button
                  onClick={handlePasswordLogin}
                  className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-sm font-semibold shadow hover:from-indigo-600 hover:to-blue-700 transition"
                >
                  直接登录
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">登录小贴士</h4>
            <ul className="text-xs text-slate-600 space-y-1">
              <li>· 邮箱验证码有效期短，请及时使用。</li>
              <li>· 登录后会同步学习进度和成就。</li>
              <li>· 如有异常可随时退出或联系客服。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
