import { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { progressStore } from '../store/progressStore';

interface EmailLoginForm {
  email: string;
  code: string;
}

export default function EmailLoginPage() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [formData, setFormData] = useState<EmailLoginForm>({
    email: '',
    code: '',
  });
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  // 邮箱验证正则
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // 发送验证码
  const sendCode = async () => {
    if (!emailRegex.test(formData.email)) {
      setMessage({ type: 'error', text: '请输入有效的邮箱地址' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/email-auth/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: formData.email }),
      });

      const result = await response.json();

      // 立即把登录态写入全局（无需刷新），会触发云端同步 Hook
      if (result?.success && result?.token && result?.user) {
        try {
          login({ user: result.user, token: result.token });
          // 登录后立即触发一次云端拉新
          try { progressStore.initializeForUser(); } catch {}
        } catch {}
      }

      if (result.success) {
        setMessage({ type: 'success', text: '验证码已发送到您的邮箱，请查收' });
        setStep('code');
        startCountdown();
      } else {
        setMessage({ type: 'error', text: result.message || '发送失败，请重试' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '网络错误，请重试' });
    } finally {
      setLoading(false);
    }
  };

  // 验证验证码
  const verifyCode = async () => {
    if (!formData.code || formData.code.length !== 6) {
      setMessage({ type: 'error', text: '请输入6位验证码' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/email-auth/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          code: formData.code,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // 保存token到localStorage（统一为 'token'）
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));

        setMessage({ type: 'success', text: '登录成功，正在跳转...' });

        // 延迟跳转，让用户看到成功消息
        setTimeout(() => {
          navigate('/');
        }, 1000);
      } else {
        setMessage({ type: 'error', text: result.message || '验证码错误' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '网络错误，请重试' });
    } finally {
      setLoading(false);
    }
  };

  // 倒计时
  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 重新发送验证码
  const resendCode = () => {
    setStep('email');
    setFormData(prev => ({ ...prev, code: '' }));
    setMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* 返回按钮 */}
        <button
          onClick={() => navigate('/login')}
          className="flex items-center text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回登录选择
        </button>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">邮箱验证登录</h1>
            <p className="text-slate-600 mt-2">
              {step === 'email' ? '输入您的邮箱地址' : '请输入收到的验证码'}
            </p>
          </div>

          {/* 消息提示 */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg flex items-center ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {message.text}
            </div>
          )}

          {/* 邮箱输入步骤 */}
          {step === 'email' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  邮箱地址
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="请输入您的邮箱地址"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && sendCode()}
                />
              </div>

              <button
                onClick={sendCode}
                disabled={loading || !formData.email}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '发送中...' : '发送验证码'}
              </button>
            </div>
          )}

          {/* 验证码输入步骤 */}
          {step === 'code' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-600">
                  验证码已发送至：<span className="font-medium text-slate-900">{formData.email}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  验证码
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => {
                    // 只允许数字，最多6位
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setFormData({ ...formData, code: value });
                  }}
                  placeholder="请输入6位验证码"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-xl font-mono"
                  onKeyPress={(e) => e.key === 'Enter' && verifyCode()}
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={verifyCode}
                  disabled={loading || formData.code.length !== 6}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '验证中...' : '登录'}
                </button>

                <button
                  onClick={resendCode}
                  disabled={countdown > 0}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {countdown > 0 ? `${countdown}s` : '重发'}
                </button>
              </div>

              <p className="text-center text-sm text-slate-600">
                没有收到邮件？请检查垃圾邮件文件夹
              </p>
            </div>
          )}

          {/* 使用说明 */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="text-sm text-slate-600 space-y-2">
              <p>💡 验证码5分钟内有效</p>
              <p>🔒 我们不会存储您的邮箱密码</p>
              <p>⏰ 验证码发送间隔1分钟</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
