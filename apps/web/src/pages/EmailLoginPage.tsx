import { useState, useEffect } from "react";
import { Mail, ArrowLeft, CheckCircle, Send, Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { progressStore } from "../store/progressStore";

interface EmailLoginForm {
  email: string;
  code: string;
}

export default function EmailLoginPage() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [formData, setFormData] = useState<EmailLoginForm>({ email: "", code: "" });
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const sendCode = async () => {
    if (!emailRegex.test(formData.email)) {
      setMessage({ type: "error", text: "请输入有效的邮箱地址" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/email-auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email })
      });

      const result = await response.json();
      if (result.success) {
        setMessage({ type: "success", text: "验证码已发送，请查收" });
        setStep("code");
        startCountdown();
      } else {
        setMessage({ type: "error", text: result.message || "发送失败，请重试" });
      }
    } catch {
      setMessage({ type: "error", text: "网络错误，请重试" });
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!formData.code || formData.code.length !== 6) {
      setMessage({ type: "error", text: "请输入 6 位验证码" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/email-auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, code: formData.code })
      });

      const result = await response.json();
      if (result.success && result.token && result.user) {
        login({ user: result.user, token: result.token });
        try {
          progressStore.initializeForUser();
        } catch (error) {
          console.warn("progress init failed", error);
        }

        setMessage({ type: "success", text: "登录成功，正在跳转..." });
        setTimeout(() => navigate("/"), 600);
      } else {
        setMessage({ type: "error", text: result.message || "验证码错误" });
      }
    } catch {
      setMessage({ type: "error", text: "网络错误，请重试" });
    } finally {
      setLoading(false);
    }
  };

  const startCountdown = () => {
    setCountdown(60);
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  const resendCode = () => {
    if (countdown > 0) return;
    sendCode();
  };

  return (
    <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center px-4 py-12 font-sans text-slate-700 relative overflow-hidden">
      {/* Playful Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-orange-100/60 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-orange-100/60 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 max-w-md w-full">
        <button
          onClick={() => navigate("/login")}
          className="group flex items-center text-slate-500 hover:text-orange-500 mb-8 transition-colors font-bold"
        >
          <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
            <ArrowLeft className="w-4 h-4" />
          </div>
          返回登录
        </button>

        <div className="bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] p-8 sm:p-10 border border-slate-100 relative overflow-hidden">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 text-orange-500 rounded-2xl mb-4 shadow-sm transform -rotate-3">
              <Mail className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-800">邮箱验证登录</h1>
            <p className="text-slate-500 mt-2 font-medium">
              {step === "email" ? "无需密码，验证码直接登录" : "请输入收到的 6 位验证码"}
            </p>
          </div>

          {message && (
            <div
              className={`mb-6 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-2 ${message.type === "success" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-500 border border-red-100"
                }`}
            >
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              {message.text}
            </div>
          )}

          {step === "email" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">邮箱地址</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@example.com"
                  className="block w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-orange-400 transition-all font-medium"
                  onKeyPress={e => e.key === "Enter" && sendCode()}
                />
              </div>

              <button
                onClick={sendCode}
                disabled={loading || !formData.email}
                className="w-full group relative overflow-hidden px-8 py-4 rounded-2xl bg-orange-500 text-white text-lg font-bold shadow-lg shadow-orange-200 hover:bg-orange-400 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? "发送中..." : "发送验证码"}
                  {!loading && <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </span>
              </button>
            </div>
          )}

          {step === "code" && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                <p className="text-sm text-slate-500 font-medium">
                  已发送至 <span className="text-slate-900 font-bold">{formData.email}</span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">验证码</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={e => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setFormData({ ...formData, code: value });
                  }}
                  placeholder="000000"
                  className="block w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 placeholder-slate-300 focus:outline-none focus:bg-white focus:border-orange-400 transition-all font-mono text-center text-2xl tracking-widest font-bold"
                  onKeyPress={e => e.key === "Enter" && verifyCode()}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={verifyCode}
                  disabled={loading || formData.code.length !== 6}
                  className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-400 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? "验证中..." : "登录"}
                </button>

                <button
                  onClick={resendCode}
                  disabled={countdown > 0}
                  className="px-6 py-4 border-2 border-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 hover:text-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
                >
                  {countdown > 0 ? (
                    <span className="flex items-center gap-1">
                      <Timer className="w-4 h-4" /> {countdown}
                    </span>
                  ) : (
                    "重发"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8 font-medium">
          遇到问题？联系客服获取帮助
        </p>
      </div>
    </div>
  );
}
