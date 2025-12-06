type SpinnerVariant = "page" | "inline";

interface LoadingSpinnerProps {
  text?: string;
  variant?: SpinnerVariant;
  className?: string;
}

// 可爱幽默的加载文案
const funnyMessages = [
  "小毛豆正在翻书本... 📚",
  "毛豆老师在准备惊喜... 🎁",
  "正在召唤英语小精灵... ✨",
  "小毛豆跑得有点慢，请稍等... 🏃",
  "课程内容太棒了，正在精心包装... 🎨",
  "毛豆在做热身运动... 💪"
];

const LoaderIcon = ({ variant }: { variant: SpinnerVariant }) => {
  const imageSize = variant === "inline" ? "h-16 w-16" : "h-36 w-36";

  return (
    <div className="relative">
      {/* 可爱的彩色光晕 */}
      <div className="absolute inset-0 -inset-10 bg-gradient-to-br from-orange-300/50 via-amber-200/40 to-yellow-300/50 dark:from-orange-400/40 dark:via-amber-300/30 dark:to-yellow-400/40 blur-3xl animate-maodou-pulse" />

      {/* 跳动的圆环装饰 */}
      <div className="absolute inset-0 -inset-6">
        <div className="absolute inset-0 rounded-full border-4 border-dashed border-orange-300/40 dark:border-orange-400/30 animate-maodou-spin" />
      </div>

      {/* Logo - 可爱透明版本 */}
      <img
        src="/icons/maodou-cute.png"
        alt="Maodou English"
        className={`${imageSize} select-none animate-maodou-float drop-shadow-2xl relative z-10`}
      />

      {/* 底部阴影 */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-900/10 dark:bg-slate-100/10 rounded-full blur-md animate-maodou-pulse" />
    </div>
  );
};

export const LoadingSpinner = ({
  text,
  variant = "page",
  className = ""
}: LoadingSpinnerProps) => {
  // 随机选择一个有趣的文案
  const randomMessage = text || funnyMessages[Math.floor(Math.random() * funnyMessages.length)];

  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        <LoaderIcon variant="inline" />
        <span className="text-base font-semibold text-slate-600 dark:text-slate-400">{randomMessage}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center min-h-[400px] py-24 gap-12 animate-in fade-in duration-700 ${className}`}>
      {/* 可爱的Logo区域 */}
      <div className="relative">
        <LoaderIcon variant="page" />

        {/* 浮动的小星星装饰 */}
        <div className="absolute -top-4 -right-4 text-3xl animate-bounce delay-100">⭐</div>
        <div className="absolute -bottom-4 -left-4 text-2xl animate-bounce delay-300">✨</div>
      </div>

      {/* 超长、可爱的进度条 */}
      <div className="w-full max-w-4xl px-8">
        {/* 主进度条容器 - 带萌萌的圆角 */}
        <div className="relative h-4 w-full rounded-full bg-gradient-to-r from-orange-100/60 via-amber-50 to-orange-100/60 dark:from-orange-900/30 dark:via-amber-900/20 dark:to-orange-900/30 overflow-hidden shadow-lg border-2 border-orange-200/50 dark:border-orange-700/30">
          {/* 可爱的光泽扫描 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20 animate-shimmer" />

          {/* 动态进度 - 渐变色彩 */}
          <div className="absolute inset-y-0 left-0 w-0 rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400 shadow-lg shadow-orange-300/60 dark:shadow-orange-500/40 animate-maodou-progress-elegant">
            {/* 内部高光 */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-full" />
            {/* 可爱的波点装饰 */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.3),transparent_50%)]" />
          </div>

          {/* 顶部高光线 */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/30 rounded-full" />
        </div>

        {/* 可爱的提示文字 */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            {/* 跳动的小毛豆emoji */}
            <span className="text-2xl animate-bounce">🫘</span>
            <span className="text-lg font-bold text-slate-700 dark:text-slate-300 tracking-wide">{randomMessage}</span>
          </div>

          {/* 可爱的小提示 */}
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md">
            小提示：毛豆老师正在努力为你准备最棒的学习内容哦~
          </p>
        </div>
      </div>
    </div>
  );
};
