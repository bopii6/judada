import React, { useEffect, useRef } from "react";
import classNames from "classnames";
import { CheckCircle2, Music, PlayCircle } from "lucide-react";
import type { MusicPhrase } from "@judada/shared";

interface LyricsProgressSidebarProps {
    phrases: MusicPhrase[];
    currentIndex: number;
    className?: string;
}

export const LyricsProgressSidebar: React.FC<LyricsProgressSidebarProps> = ({
    phrases,
    currentIndex,
    className
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeItemRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to active item
    useEffect(() => {
        if (activeItemRef.current && scrollRef.current) {
            activeItemRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }, [currentIndex]);

    return (
        <div className={classNames("flex flex-col h-full bg-white/50 backdrop-blur-sm border-r border-white/60", className)}>
            <div className="p-6 border-b border-white/40">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Music className="w-5 h-5 text-indigo-500" />
                    <span>关卡地图</span>
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
                    已完成 {currentIndex + 1} / {phrases.length}
                </p>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                {phrases.map((phrase, index) => {
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex;
                    const isLocked = index > currentIndex;

                    return (
                        <div
                            key={index}
                            ref={isCurrent ? activeItemRef : null}
                            className={classNames(
                                "relative p-3 rounded-xl border-2 transition-all duration-300",
                                isCompleted
                                    ? "bg-emerald-50/50 border-emerald-100 text-slate-400"
                                    : isCurrent
                                        ? "bg-white border-indigo-500 shadow-lg shadow-indigo-500/10 scale-105 z-10"
                                        : "bg-slate-50/50 border-transparent text-slate-300"
                            )}
                        >
                            <div className="flex items-start gap-3">
                                {/* Status Icon */}
                                <div className="mt-0.5 shrink-0">
                                    {isCompleted ? (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                    ) : isCurrent ? (
                                        <PlayCircle className="w-5 h-5 text-indigo-500 animate-pulse" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full border-2 border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-300">
                                            {index + 1}
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    {isLocked ? (
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <div className="h-2 w-16 bg-slate-200 rounded-full" />
                                            <div className="h-2 w-8 bg-slate-200 rounded-full" />
                                        </div>
                                    ) : (
                                        <>
                                            <p className={classNames(
                                                "text-sm font-bold leading-snug",
                                                isCurrent ? "text-slate-800" : "text-slate-500 line-through decoration-emerald-200"
                                            )}>
                                                {phrase.en}
                                            </p>
                                            {isCurrent && phrase.zh && (
                                                <p className="text-xs font-medium text-indigo-500 mt-1">
                                                    {phrase.zh}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Connector Line */}
                            {index < phrases.length - 1 && (
                                <div className={classNames(
                                    "absolute left-[21px] top-full h-3 w-0.5 -mb-3 z-0",
                                    isCompleted ? "bg-emerald-200" : "bg-slate-200"
                                )} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
