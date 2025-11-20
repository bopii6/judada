import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Users, Target, Star, Mail, LockKeyhole, ArrowRight, Smile } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { progressStore } from "../store/progressStore";

const features = [
  {
    icon: <BookOpen className="h-7 w-7 text-sky-500" />,
    bg: "bg-sky-100",
    title: "轻松学英语",
    description: "像玩游戏一样有趣，涵盖听说读写全方位练习"
  },
  {
    icon: <Users className="h-7 w-7 text-emerald-500" />,
    bg: "bg-emerald-100",
    title: "专属你的计划",
    description: "AI 老师为你量身定制，每天进步一点点"
  },
  {
    icon: <Target className="h-7 w-7 text-violet-500" />,
    bg: "bg-violet-100",
    title: "闯关大冒险",
    description: "完成挑战赢取奖励，学习不再枯燥"
  },
  {
    icon: <Star className="h-7 w-7 text-amber-500" />,
    bg: "bg-amber-100",
    title: "记录成长点滴",
    description: "看着自己一天天变强，成就感满满"
  }
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithPassword } = useAuth();
  const [pwdEmail, setPwdEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordLogin = async () => {
    if (!pwdEmail || !pwd) {
      setPwdError("别忘了填邮箱和密码哦");
      return;
    }
    setPwdError(null);
    setIsLoading(true);
    try {
      await loginWithPassword(pwdEmail.trim(), pwd);
      try {
        progressStore.initializeForUser();
      } catch (error) {
        console.warn("progress init failed", error);
      }
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const fallbackMessage = "??????????????????????????????";
      if (err instanceof Error) {
        setPwdError(err.message || fallbackMessage);
      } else {
        setPwdError(fallbackMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center px-6 py-12 font-sans text-slate-700 relative overflow-hidden">
      {/* Playful Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-orange-100/60 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-sky-100/60 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-emerald-100/40 rounded-full blur-3xl animate-pulse delay-2000" />

      <div className="relative z-10 max-w-6xl w-full grid lg:grid-cols-2 gap-20 items-center">
        {/* Left Side - Brand & Features */}
        <div className="text-center lg:text-left space-y-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-orange-500 shadow-sm border border-orange-100 transform hover:scale-105 transition-transform cursor-default">
              <Smile className="h-5 w-5" />
              <span>快乐学习，天天向上</span>
            </div>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tight text-slate-800 leading-[1.1]">
              Hello! <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">
                Jude English
              </span>
            </h1>
            <p className="text-xl text-slate-500 max-w-lg mx-auto lg:mx-0 leading-relaxed font-medium">
              这里没有枯燥的死记硬背。
              <br />
              只有轻松有趣的探索之旅，准备好出发了吗？
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group flex items-start space-x-5 rounded-[2rem] bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 border border-slate-100"
              >
                <div className={`flex-shrink-0 p-3 rounded-2xl ${feature.bg} group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-slate-800 text-lg mb-1">{feature.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Login Card */}
        <div className="bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] p-10 lg:p-12 relative border border-slate-100">
          <div className="relative h-full flex flex-col">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-400 to-pink-500 rounded-[2rem] mb-6 shadow-lg shadow-orange-500/20 transform -rotate-6 hover:rotate-0 transition-transform duration-300">
                <BookOpen className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-3">欢迎回来！</h2>
              <p className="text-base text-slate-500 font-medium">今天也要元气满满地学习哦</p>
            </div>

            <div className="space-y-8 flex-1">
              {/* 邮箱验证码登录 (Secondary) */}
              <button
                onClick={() => navigate("/email-login")}
                className="w-full group relative flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 hover:bg-white hover:border-orange-200 text-slate-600 hover:text-orange-500 transition-all duration-300 font-bold"
              >
                <Mail className="h-5 w-5" />
                <span>用验证码登录</span>
                <ArrowRight className="h-5 w-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 absolute right-6" />
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-slate-100"></div>
                </div>
                <div className="relative flex justify-center text-sm font-bold uppercase tracking-wider">
                  <span className="bg-white px-4 text-slate-400">或者</span>
                </div>
              </div>

              {/* 邮箱 + 密码登录 (Primary) */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">邮箱</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                    </div>
                    <input
                      className="block w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-orange-400 transition-all font-medium"
                      placeholder="name@example.com"
                      value={pwdEmail}
                      onChange={e => setPwdEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">密码</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <LockKeyhole className="h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                    </div>
                    <input
                      type="password"
                      className="block w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-orange-400 transition-all font-medium"
                      placeholder="••••••••"
                      value={pwd}
                      onChange={e => setPwd(e.target.value)}
                    />
                  </div>
                </div>

                {pwdError && (
                  <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-100 text-red-500 text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    {pwdError}
                  </div>
                )}

                <button
                  onClick={handlePasswordLogin}
                  disabled={isLoading}
                  className="w-full relative overflow-hidden group px-8 py-4 rounded-2xl bg-slate-900 text-white text-lg font-bold shadow-xl shadow-slate-200 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <span className="relative flex items-center justify-center gap-3">
                    {isLoading ? "登录中..." : "开始学习"}
                    {!isLoading && <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
