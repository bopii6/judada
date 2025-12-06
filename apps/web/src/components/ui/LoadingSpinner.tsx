type SpinnerVariant = "page" | "inline";

interface LoadingSpinnerProps {
  text?: string;
  variant?: SpinnerVariant;
  className?: string;
}

const LoaderIcon = ({ variant }: { variant: SpinnerVariant }) => {
  const imageSize = variant === "inline" ? "h-16 w-16" : "h-32 w-32";

  return (
    <div className="relative">
      {/* 柔和的光晕效果 */}
      <div className="absolute inset-0 -inset-8 bg-gradient-to-br from-orange-300/40 via-amber-300/30 to-yellow-300/40 dark:from-orange-500/30 dark:via-amber-500/20 dark:to-yellow-500/30 blur-3xl animate-maodou-pulse" />

      {/* Logo - 大而醒目 */}
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
        <span className="text-base font-semibold text-slate-600 dark:text-slate-400">{text}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center py-24 gap-16 animate-in fade-in duration-700 ${className}`}>
      {/* Logo - 大而醒目 */}
      <LoaderIcon variant="page" />

      {/* 优雅的进度条区域 */}
      <div className="w-full max-w-3xl px-8">
        {/* 主进度条 - 更高更长 */}
        <div className="relative h-3 w-full rounded-full bg-gradient-to-r from-slate-100/80 via-slate-50 to-slate-100/80 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 overflow-hidden shadow-lg border border-slate-200/50 dark:border-slate-700/50">
          {/* 渐变光泽扫描 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10 animate-shimmer" />

          {/* 动态进度填充 */}
          <div className="absolute inset-y-0 left-0 w-0 rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 shadow-lg shadow-orange-400/60 dark:shadow-orange-500/40 animate-maodou-progress-elegant">
            {/* 进度条内部高光 */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
          </div>

          {/* 顶部高光线 */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/20" />
        </div>

        {/* 进度指示文字 */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 dark:from-orange-400 dark:to-orange-500 animate-pulse shadow-lg shadow-orange-400/60" />
          <span className="text-base font-semibold text-slate-600 dark:text-slate-400 tracking-wide">{text}</span>
        </div>
      </div>
    </div>
  );
};
