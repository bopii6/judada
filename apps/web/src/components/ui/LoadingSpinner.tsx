import { Loader2 } from "lucide-react";

export const LoadingSpinner = ({ text = "正在加载精彩内容..." }: { text?: string }) => {
    return (
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
            <div className="relative">
                {/* Outer glowing ring */}
                <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full animate-pulse" />

                {/* Spinner */}
                <div className="relative bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl border border-orange-100 dark:border-orange-900/30">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                </div>
            </div>

            <p className="mt-6 text-sm font-bold text-slate-400 dark:text-slate-500 animate-pulse">
                {text}
            </p>
        </div>
    );
};
