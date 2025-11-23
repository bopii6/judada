import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Star, RefreshCw, ArrowRight, Trophy } from "lucide-react";
import classNames from "classnames";

interface ScorecardProps {
    score: number; // 0-100
    accuracy: number; // 0-100
    onRestart: () => void;
    onExit?: () => void;
}

export const Scorecard = ({ score, accuracy, onRestart, onExit }: ScorecardProps) => {
    const [stars, setStars] = useState(0);

    useEffect(() => {
        // Calculate stars based on score
        let starCount = 1;
        if (score >= 90) starCount = 3;
        else if (score >= 60) starCount = 2;

        // Animate stars one by one
        const timer = setInterval(() => {
            setStars(prev => {
                if (prev < starCount) return prev + 1;
                clearInterval(timer);
                return prev;
            });
        }, 400);

        // Trigger confetti
        const duration = 3000;
        const end = Date.now() + duration;

        const frame = () => {
            confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#FFD700', '#FF69B4', '#00BFFF']
            });
            confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#FFD700', '#FF69B4', '#00BFFF']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };

        frame();

        return () => clearInterval(timer);
    }, [score]);

    const getMessage = () => {
        if (score >= 90) return "Perfect Harmony!";
        if (score >= 60) return "Great Rhythm!";
        return "Keep Practicing!";
    };

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto animate-in fade-in zoom-in duration-500">
            <div className="relative bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 w-full text-center">

                {/* Trophy Icon */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                    <div className="w-24 h-24 bg-gradient-to-br from-yellow-300 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-200 border-4 border-white">
                        <Trophy className="w-12 h-12 text-white drop-shadow-md" />
                    </div>
                </div>

                <div className="mt-12 space-y-6">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">
                        {getMessage()}
                    </h2>

                    {/* Stars */}
                    <div className="flex justify-center gap-3 py-4">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={classNames(
                                    "transition-all duration-500 transform",
                                    i <= stars
                                        ? "scale-110 text-yellow-400 drop-shadow-lg rotate-[15deg]"
                                        : "scale-100 text-slate-200"
                                )}
                            >
                                <Star
                                    className={classNames(
                                        "w-12 h-12 fill-current",
                                        i <= stars ? "animate-bounce-short" : ""
                                    )}
                                    strokeWidth={2.5}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Score</span>
                            <span className="text-2xl font-black text-slate-800">{score}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Accuracy</span>
                            <span className="text-2xl font-black text-slate-800">{Math.round(accuracy)}%</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 pt-4">
                        <button
                            onClick={onRestart}
                            className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-slate-900 text-white px-8 py-4 text-sm font-bold uppercase tracking-widest shadow-xl shadow-slate-900/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Play Again
                        </button>

                        {onExit && (
                            <button
                                onClick={onExit}
                                className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-white text-slate-600 border-2 border-slate-100 px-8 py-4 text-sm font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors"
                            >
                                <ArrowRight className="w-4 h-4" />
                                Back to Menu
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
