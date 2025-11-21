import React, { useMemo } from "react";
import classNames from "classnames";
import { Music } from "lucide-react";

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
    const gradient = useMemo(() => {
        let hash = 0;
        for (let i = 0; i < title.length; i++) {
            hash = title.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % GRADIENTS.length;
        return GRADIENTS[index];
    }, [title]);

    const sizeClasses = {
        sm: "w-12 h-12 rounded-lg",
        md: "w-32 h-32 rounded-2xl",
        lg: "w-48 h-48 rounded-3xl",
        xl: "w-full aspect-square rounded-[2rem]",
    };

    if (url) {
        return (
            <div className={classNames("relative overflow-hidden bg-slate-100", sizeClasses[size], className)}>
                <img
                    src={url}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-[inherit]" />
            </div>
        );
    }

    return (
        <div className={classNames(
            "relative overflow-hidden flex items-center justify-center bg-gradient-to-br shadow-inner",
            gradient,
            sizeClasses[size],
            className
        )}>
            <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" />
            <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-white/20 blur-2xl rounded-full" />
            <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-black/5 blur-2xl rounded-full" />

            <Music className={classNames(
                "relative z-10 text-white/90 drop-shadow-md",
                size === "sm" ? "w-5 h-5" :
                    size === "md" ? "w-12 h-12" :
                        size === "lg" ? "w-16 h-16" : "w-24 h-24"
            )} />
        </div>
    );
};
