import React, { useState } from "react";
import { Crown, Check, Zap, Infinity, Gift, QrCode, X, Shield, Star } from "lucide-react";
import classNames from "classnames";

type MembershipTier = 'free' | 'lifetime';

interface MembershipPlan {
  id: MembershipTier;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  features: string[];
  icon: React.ReactNode;
  gradient: string;
  badge?: string;
  popular?: boolean;
}

const plans: MembershipPlan[] = [
  {
    id: 'free',
    name: '免费方案',
    price: 0,
    description: '适合初学者，体验基础功能',
    features: [
      '基础课程学习',
      '每日学习记录',
      '基础音效设置',
      '社区支持'
    ],
    icon: <Gift className="w-6 h-6" />,
    gradient: 'from-slate-400 to-slate-500',
  },
  {
    id: 'lifetime',
    name: '终身会员',
    price: 299,
    originalPrice: 599,
    description: '一次付费，终身享受所有高级功能',
    features: [
      '所有免费功能',
      '无限课程访问',
      '高级音效和主题',
      '优先客服支持',
      '专属会员标识',
      '学习数据分析',
      '自定义学习计划',
      '无广告体验',
      '未来所有新功能'
    ],
    icon: <Crown className="w-6 h-6" />,
    gradient: 'from-amber-400 to-orange-500',
    badge: '限时特惠',
    popular: true
  }
];

export const Membership: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<MembershipTier | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success'>('idle');
  const [orderId, setOrderId] = useState<string>('');

  const generateOrderId = () => {
    return `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  };

  const handleSelectPlan = (planId: MembershipTier) => {
    if (planId === 'free') {
      setPaymentStatus('success');
      setTimeout(() => {
        setPaymentStatus('idle');
      }, 3000);
      return;
    }

    setSelectedPlan(planId);
    const newOrderId = generateOrderId();
    setOrderId(newOrderId);
    setShowQRCode(true);
    setPaymentStatus('pending');
  };

  const handleCloseQRCode = () => {
    setShowQRCode(false);
    setSelectedPlan(null);
    setPaymentStatus('idle');
  };

  const handleConfirmPayment = () => {
    setPaymentStatus('success');
    setTimeout(() => {
      setShowQRCode(false);
      setSelectedPlan(null);
      setPaymentStatus('idle');
    }, 3000);
  };

  const currentPlan = plans.find(p => p.id === 'free');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-orange-500/30">
      {/* Abstract Background Shapes */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl translate-y-1/2" />
      </div>

      <div className="relative">
        {/* Pricing Cards */}
        <div className="max-w-6xl mx-auto px-6 pb-24 pt-12">
          <div className="grid md:grid-cols-2 gap-8 items-start max-w-4xl mx-auto">
            {plans.map((plan, index) => {
              const isCurrentPlan = currentPlan?.id === plan.id;
              const isPopular = plan.popular;

              return (
                <div
                  key={plan.id}
                  className={classNames(
                    "relative group rounded-3xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-8",
                    isPopular
                      ? "bg-white dark:bg-slate-900/80 border-2 border-orange-500/20 shadow-2xl shadow-orange-500/10 z-10 md:-mt-4 md:mb-4"
                      : "bg-white/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-900/60",
                    index === 1 ? "delay-300" : "delay-200"
                  )}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                      <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold shadow-lg shadow-orange-500/20">
                        <Crown className="w-3 h-3 fill-current" />
                        {plan.badge}
                      </div>
                    </div>
                  )}

                  <div className="p-8">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <div className={classNames(
                          "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-lg",
                          `bg-gradient-to-br ${plan.gradient} text-white`
                        )}>
                          {plan.icon}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                          {plan.name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {plan.description}
                        </p>
                      </div>
                      <div className="text-right">
                        {plan.price === 0 ? (
                          <div className="text-3xl font-black text-slate-900 dark:text-white">免费</div>
                        ) : (
                          <div>
                            <div className="flex items-baseline justify-end gap-1">
                              <span className="text-sm text-slate-400 font-medium">¥</span>
                              <span className="text-4xl font-black text-slate-900 dark:text-white">{plan.price}</span>
                            </div>
                            {plan.originalPrice && (
                              <div className="text-sm text-slate-400 line-through mt-1">
                                ¥{plan.originalPrice}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 mb-8">
                      {plan.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-3 group/item">
                          <div className={classNames(
                            "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                            isPopular
                              ? "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 group-hover/item:bg-orange-500 group-hover/item:text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          )}>
                            <Check className="w-3 h-3" />
                          </div>
                          <span className="text-sm text-slate-600 dark:text-slate-300">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isCurrentPlan}
                      className={classNames(
                        "w-full py-4 rounded-xl font-bold text-sm transition-all duration-300",
                        isCurrentPlan
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                          : isPopular
                            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5 active:translate-y-0"
                            : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 hover:-translate-y-0.5 active:translate-y-0"
                      )}
                    >
                      {isCurrentPlan ? "当前方案" : plan.price === 0 ? "立即开始" : "立即升级"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trust Indicators */}
          <div className="mt-20 pt-10 border-t border-slate-200 dark:border-slate-800/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { label: "活跃用户", value: "10,000+", icon: <Zap className="w-4 h-4" /> },
                { label: "课程内容", value: "500+", icon: <Infinity className="w-4 h-4" /> },
                { label: "好评率", value: "99%", icon: <Star className="w-4 h-4" /> },
                { label: "安全支付", value: "SSL加密", icon: <Shield className="w-4 h-4" /> },
              ].map((stat, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs font-medium uppercase tracking-wider">
                    {stat.icon}
                    {stat.label}
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mt-24 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-10">
              常见问题
            </h2>
            <div className="space-y-4">
              {[
                { q: "终身会员包含哪些功能？", a: "终身会员包含所有免费功能，以及无限课程访问、高级音效和主题、优先客服支持等所有高级权益。" },
                { q: "如何支付？", a: "目前支持微信扫码支付。选择终身会员后，会显示微信收款二维码，扫描后完成支付即可。" },
                { q: "支付后多久生效？", a: "支付完成后，系统会自动识别并立即激活会员权益。通常在1分钟内完成。" },
                { q: "可以退款吗？", a: "由于是数字产品，一经激活不支持退款。如有特殊情况，请联系客服协商处理。" }
              ].map((faq, index) => (
                <div key={index} className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 hover:border-orange-200 dark:hover:border-orange-900/50 transition-colors">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                    {faq.q}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showQRCode && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative bg-white dark:bg-slate-900 rounded-[2rem] p-0 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

              <button
                onClick={handleCloseQRCode}
                className="absolute top-4 right-4 p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold">微信扫码支付</h3>
              </div>
              <p className="text-slate-400 text-xs pl-12">
                安全支付 · 实时到账
              </p>
            </div>

            <div className="p-8">
              {/* Amount */}
              <div className="text-center mb-8">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">支付金额</p>
                <div className="flex items-baseline justify-center gap-1 text-slate-900 dark:text-white">
                  <span className="text-xl font-bold">¥</span>
                  <span className="text-5xl font-black tracking-tight">{plans.find(p => p.id === selectedPlan)?.price}</span>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="flex justify-center mb-8">
                <div className="p-1 bg-white rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800">
                  <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center overflow-hidden relative group">
                    <img
                      src="/qrcode.png"
                      alt="微信支付二维码"
                      className="w-full h-full object-contain"
                    />
                    {/* Scan Hint Overlay */}
                    <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold text-slate-900 shadow-sm">
                        请使用微信扫一扫
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Info */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 mb-6 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">订单号</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 select-all">{orderId}</span>
              </div>

              {/* Action Button */}
              <button
                onClick={handleConfirmPayment}
                disabled={paymentStatus === 'success'}
                className={classNames(
                  "w-full py-4 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0",
                  paymentStatus === 'success'
                    ? "bg-green-500 text-white shadow-green-500/25"
                    : "bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 text-white dark:text-slate-900 shadow-slate-900/20"
                )}
              >
                {paymentStatus === 'success' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />
                    支付成功
                  </span>
                ) : paymentStatus === 'pending' ? (
                  "我已完成支付"
                ) : (
                  "确认支付"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
