import React, { useMemo } from "react";
import classNames from "classnames";
import { Music } from "lucide-react";
import { getCachedCoverUrl } from "../utils/musicAssetCache";

interface MusicCoverProps {
    url?: string | null;
    title: string;
    className?: string;
    size?: "sm" | "md" | "lg" | "xl";
}

const GRADIENTS = [
    "from-rose-400 to-orange-300",
    "from-violet-600 to-indigo-600",
    "from-cyan-500 to-blue-500",
    "from-emerald-400 to-cyan-400",
    "from-fuchsia-500 to-pink-500",
    "from-amber-200 to-yellow-400",
    "from-teal-400 to-yellow-200",
    "from-blue-600 to-violet-600",
];

export const MusicCover = ({ url, title, className, size = "md" }: MusicCoverProps) => {
    const resolvedUrl = url ? getCachedCoverUrl(url) : undefined;
    const gradient = useMemo(() => {
        let hash = 0;
        for (let i = 0; i < title.length; i++) {
            hash = title.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % GRADIENTS.length;
        return GRADIENTS[index];
    }, [title]);

    const sizeClasses = {
        sm: "w-12 h-12 rounded-xl border-2 border-white shadow-md",
        md: "w-32 h-32 rounded-3xl border-4 border-white shadow-xl",
        lg: "w-48 h-48 rounded-[2rem] border-[6px] border-white shadow-2xl",
        xl: "w-full aspect-square rounded-[2.5rem] border-[8px] border-white shadow-[0_20px_50px_rgba(0,0,0,0.1)]",
    };

    // Sticker shadow color based on gradient
    const shadowColorClass = useMemo(() => {
        if (gradient.includes("rose") || gradient.includes("pink")) return "shadow-rose-200";
        if (gradient.includes("violet") || gradient.includes("indigo")) return "shadow-indigo-200";
        if (gradient.includes("cyan") || gradient.includes("blue")) return "shadow-blue-200";
        if (gradient.includes("emerald") || gradient.includes("teal")) return "shadow-emerald-200";
        if (gradient.includes("amber") || gradient.includes("yellow")) return "shadow-amber-200";
        return "shadow-slate-200";
    }, [gradient]);

    if (resolvedUrl) {
        return (
            <div className={classNames(
                "relative overflow-hidden bg-white transition-transform duration-300 hover:scale-105 hover:rotate-2",
                sizeClasses[size],
                className
            )}>
                <img
                    src={resolvedUrl}
                    alt={title}
                    className="w-full h-full object-cover"
                />
                {/* Glossy overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none" />
            </div>
        );
    }

    return (
        <div className={classNames(
            "relative overflow-hidden flex items-center justify-center bg-gradient-to-br transition-transform duration-300 hover:scale-105 hover:rotate-2",
            gradient,
            sizeClasses[size],
            shadowColorClass,
            className
        )}>
            <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" />

            {/* Cute patterns */}
            <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-white/20 blur-xl rounded-full animate-blob" />
            <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/20 blur-xl rounded-full animate-blob animation-delay-2000" />

            <Music className={classNames(
                "relative z-10 text-white drop-shadow-lg transform -rotate-12",
                size === "sm" ? "w-6 h-6" :
                    size === "md" ? "w-14 h-14" :
                        size === "lg" ? "w-20 h-20" : "w-28 h-28"
            )} />
        </div>
    );
};
