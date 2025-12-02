import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWordDefinition } from "../api/dictionary";
import { Sparkles } from "lucide-react";

interface WordHoverCardProps {
    word: string;
    children: React.ReactNode;
    onClick?: () => void;
}

export const WordHoverCard: React.FC<WordHoverCardProps> = ({ word, children, onClick }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const hoverTimeoutRef = useRef<number | null>(null);

    // Clean word for lookup
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");

    // Fetch definition only when tooltip is about to show
    const { data: definition, isLoading } = useQuery({
        queryKey: ["word-definition", cleanWord],
        queryFn: () => fetchWordDefinition(cleanWord),
        enabled: showTooltip && !!cleanWord,
        staleTime: 1000 * 60 * 60, // Cache for 1 hour
        retry: false
    });

    const handleMouseEnter = () => {
        // Delay showing tooltip to prevent flashing during quick mouse movement
        hoverTimeoutRef.current = window.setTimeout(() => {
            setShowTooltip(true);
        }, 300);
    };

    const handleMouseLeave = () => {
        setShowTooltip(false);
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
    };

    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
        };
    }, []);

    return (
        <span
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* The Word Itself */}
            <span
                onClick={onClick}
                className="cursor-pointer hover:text-orange-600 hover:scale-105 transition-all duration-200 active:scale-95 inline-block"
            >
                {children}
            </span>

            {/* Tooltip */}
            {showTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 w-64 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-orange-500/10 border border-orange-50 p-4 relative">
                        {/* Arrow */}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-b border-r border-orange-50" />

                        {isLoading ? (
                            <div className="flex items-center justify-center py-2 gap-2 text-orange-400">
                                <Sparkles className="w-4 h-4 animate-spin" />
                                <span className="text-xs font-bold">Thinking...</span>
                            </div>
                        ) : definition ? (
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <span className="text-2xl filter drop-shadow-sm">{definition.emoji}</span>
                                    <span className="text-lg font-black text-slate-800">{definition.translation}</span>
                                </div>
                                <p className="text-xs font-medium text-slate-500 leading-relaxed">
                                    {definition.definitionCn}
                                </p>
                            </div>
                        ) : (
                            <div className="text-center py-1 text-xs text-slate-400">
                                No definition found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </span>
    );
};
