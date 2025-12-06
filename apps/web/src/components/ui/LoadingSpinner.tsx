type SpinnerVariant = "page" | "inline";

interface LoadingSpinnerProps {
  text?: string;
  variant?: SpinnerVariant;
  className?: string;
}

const LoaderIcon = ({ variant }: { variant: SpinnerVariant }) => {
  const imageSize = variant === "inline" ? "h-12 w-12" : "h-20 w-20";

  return (
    <div className="relative">
      {/* 简洁的光晕效果 */}
      <div className="absolute inset-0 -inset-x-4 -inset-y-4 bg-gradient-to-br from-orange-200/30 via-amber-200/20 to-yellow-200/30 dark:from-orange-500/20 dark:via-amber-500/10 dark:to-yellow-500/20 blur-3xl animate-maodou-pulse" />

      {/* Logo - 原版精美设计 */}
      <img
        src="/icons/maodou-logo-final.png"
        alt="Maodou English"
        className={`${imageSize} select-none animate-maodou-float drop-shadow-2xl relative z-10`}
        style={{
          WebkitMaskImage: 'linear-gradient(black, black)',
          maskImage: 'linear-gradient(black, black)'
        }}
      />
    </div>
  );
};

export const LoadingSpinner = ({
  text = "毛豆老师正在为你加载精彩内容...",
  variant = "page",
  className = ""
}: LoadingSpinnerProps) => {
  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        <LoaderIcon variant="inline" />
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{text}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center py-20 gap-10 animate-in fade-in duration-700 ${className}`}>
      {/* Logo */}
      <LoaderIcon variant="page" />

      {/* 优雅的进度条 */}
      <div className="w-full max-w-2xl px-4">
        {/* 主进度条 */}
        <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 overflow-hidden shadow-inner">
          {/* 渐变光泽条 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10 animate-shimmer" />

          {/* 动态进度 */}
          <div className="absolute inset-y-0 left-0 w-0 rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 shadow-lg shadow-orange-400/50 dark:shadow-orange-500/30 animate-maodou-progress-elegant" />

          {/* 顶部高光 */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20" />
        </div>

        {/* 进度指示文字 */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-orange-500 dark:bg-orange-400 animate-pulse shadow-lg shadow-orange-400/50" />
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 tracking-wide">{text}</span>
        </div>
      </div>
    </div>
  );
};
