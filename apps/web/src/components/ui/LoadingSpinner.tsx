type SpinnerVariant = "page" | "inline";

interface LoadingSpinnerProps {
  text?: string;
  variant?: SpinnerVariant;
  className?: string;
}

const LoaderIcon = ({ variant }: { variant: SpinnerVariant }) => {
  const sizeClass = variant === "inline" ? "h-16 w-16" : "h-32 w-32";
  const insetClass = variant === "inline" ? "inset-1.5" : "inset-2.5";
  const spinClass = variant === "inline" ? "animate-maodou-spin-fast" : "animate-maodou-spin";
  const imageSize = variant === "inline" ? "h-10 w-10" : "h-16 w-16";

  return (
    <div className={`relative ${sizeClass}`}>
      <div className="absolute inset-0 rounded-[2rem] bg-emerald-200/40 blur-2xl animate-maodou-pulse" />
      <div className={`absolute ${insetClass} rounded-[1.5rem] border-2 border-dashed border-emerald-200/70 dark:border-emerald-900/60 ${spinClass}`} />
      <div className="relative flex h-full w-full items-center justify-center rounded-[1.5rem] border border-emerald-100/70 dark:border-emerald-900/40 bg-white/90 dark:bg-slate-900/80 shadow-xl shadow-emerald-200/30 dark:shadow-emerald-900/20">
        <img
          src="/icons/maodou-logo.svg"
          alt="毛豆英语"
          className={`${imageSize} select-none animate-maodou-float drop-shadow-lg`}
        />
      </div>
    </div>
  );
};

const ProgressRunner = () => (
  <div className="pointer-events-none absolute -top-10 left-0 w-16 h-12 animate-maodou-run">
    <div className="relative h-full w-full">
      <div className="absolute inset-x-2 top-2 h-8 rounded-full bg-gradient-to-r from-emerald-300 to-emerald-500 shadow-lg shadow-emerald-300/60 rotate-[-6deg]" />
      <div className="absolute inset-x-3 top-3 h-6 rounded-full bg-white/10" />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-white/85" />
        <span className="w-2 h-2 rounded-full bg-white/85" />
        <span className="w-4 h-1 rounded-full bg-white/85" />
      </div>
      <div className="absolute -bottom-1 left-3 w-2 h-4 rounded-full bg-emerald-500 rotate-[20deg] origin-top animate-bounce" />
      <div className="absolute -bottom-1 right-3 w-2 h-4 rounded-full bg-emerald-600 -rotate-[12deg] origin-top animate-bounce delay-200" />
      <div className="absolute top-2 -left-1 w-2 h-3 rounded-full bg-emerald-400 -rotate-[25deg] animate-pulse" />
      <div className="absolute top-2 -right-1 w-2 h-3 rounded-full bg-emerald-400 rotate-[25deg] animate-pulse delay-150" />
    </div>
  </div>
);

export const LoadingSpinner = ({
  text = "毛豆老师正在为你加载精彩内容...",
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
    <div className={`flex flex-col items-center justify-center py-20 gap-6 animate-in fade-in duration-500 ${className}`}>
      <LoaderIcon variant="page" />
      <div className="w-full max-w-md">
        <div className="relative h-4 w-full rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-100/60 dark:border-slate-700/70 overflow-hidden">
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-amber-200 shadow-inner animate-maodou-progress" />
          <ProgressRunner />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>小毛豆正在拉动进度条...</span>
        </div>
      </div>
      <p className="text-sm font-bold text-slate-400 dark:text-slate-500 animate-pulse">{text}</p>
    </div>
  );
};
