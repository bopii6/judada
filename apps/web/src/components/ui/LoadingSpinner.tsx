type SpinnerVariant = "page" | "inline";

interface LoadingSpinnerProps {
  text?: string;
  variant?: SpinnerVariant;
  className?: string;
}

const LoaderIcon = ({ variant }: { variant: SpinnerVariant }) => {
  const sizeClass = variant === "inline" ? "h-14 w-14" : "h-24 w-24";
  const insetClass = variant === "inline" ? "inset-1" : "inset-2";
  const spinClass = variant === "inline" ? "animate-bear-spin-fast" : "animate-bear-spin";
  const imageSize = variant === "inline" ? "h-8 w-8" : "h-12 w-12";

  return (
    <div className={`relative ${sizeClass}`}>
      <div className="absolute inset-0 rounded-[1.75rem] bg-orange-400/15 blur-2xl animate-pulse" />
      <div
        className={`absolute ${insetClass} rounded-[1.5rem] border border-dashed border-orange-200/70 dark:border-orange-900/60 ${spinClass}`}
      />
      <div className="relative flex h-full w-full items-center justify-center rounded-[1.5rem] border border-orange-100/70 dark:border-orange-900/40 bg-white/90 dark:bg-slate-900/80 shadow-xl shadow-orange-200/30 dark:shadow-orange-900/10">
        <img
          src="/icons/bear-icon.svg"
          alt="Jude English"
          className={`${imageSize} select-none animate-bear-float`}
        />
      </div>
    </div>
  );
};

export const LoadingSpinner = ({
  text = "正在加载精彩内容...",
  variant = "page",
  className = ""
}: LoadingSpinnerProps) => {
  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <LoaderIcon variant="inline" />
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{text}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center py-20 animate-in fade-in duration-500 ${className}`}>
      <LoaderIcon variant="page" />
      <p className="mt-6 text-sm font-bold text-slate-400 dark:text-slate-500 animate-pulse">{text}</p>
    </div>
  );
};
