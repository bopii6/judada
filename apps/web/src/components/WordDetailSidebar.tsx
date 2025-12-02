import React, { useRef } from "react";
import { X, Volume2, BookOpen } from "lucide-react";
import classNames from "classnames";
import { WordDefinition } from "../data/dictionary";

interface WordDetailSidebarProps {
    word: string | null;
    definition: WordDefinition | null;
    isOpen: boolean;
    isLoading?: boolean;
    onClose: () => void;
}

export const WordDetailSidebar = ({ word, definition, isOpen, isLoading, onClose }: WordDetailSidebarProps) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const playAudio = () => {
        if (definition?.audioUrl && audioRef.current) {
            audioRef.current.src = definition.audioUrl;
            audioRef.current.play().catch(err => console.error("Audio playback failed:", err));
        }
    };

    return (
        <div
            className={classNames(
                "fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-100",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}
        >
            <audio ref={audioRef} />

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-orange-600 font-bold">
                    <BookOpen className="w-5 h-5" />
                    <span>单词助手</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto h-[calc(100vh-80px)]">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
                        </div>
                        <p>正在查询单词...</p>
                    </div>
                ) : word && definition ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        {/* Word Header */}
                        <div className="text-center space-y-4">
                            <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-gradient-to-br from-orange-50 to-amber-50 text-6xl shadow-inner border border-white">
                                {definition.emoji || "📝"}
                            </div>
                            <div>
                                <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-1 capitalize">
                                    {definition.word}
                                </h2>
                                {definition.translation && (
                                    <p className="text-2xl font-bold text-orange-600 mb-2">
                                        {definition.translation}
                                    </p>
                                )}
                                <div className="flex items-center justify-center gap-3 text-slate-500">
                                    <span className="font-mono text-lg bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                                        {definition.phonetic}
                                    </span>
                                    {definition.audioUrl && (
                                        <button
                                            onClick={playAudio}
                                            className="p-1.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded-full transition-colors active:scale-95"
                                        >
                                            <Volume2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Definition Card */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
                            <div>
                                <span className="inline-block px-2 py-1 rounded-md bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wider mb-2">
                                    {definition.partOfSpeech}
                                </span>
                                {/* Chinese Translation */}
                                {definition.definitionCn && (
                                    <p className="text-slate-800 font-semibold leading-relaxed mb-2 text-lg">
                                        {definition.definitionCn}
                                    </p>
                                )}
                                {/* English Definition */}
                                <p className="text-slate-600 leading-relaxed text-sm">
                                    {definition.definition}
                                </p>
                            </div>

                            {definition.example && (
                                <div className="pt-4 border-t border-slate-50">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        Example
                                    </p>
                                    <p className="text-slate-600 italic border-l-2 border-orange-200 pl-3 py-1">
                                        &ldquo;{definition.example}&rdquo;
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                            <BookOpen className="w-8 h-8 text-slate-300" />
                        </div>
                        <p>点击任意单词<br />查看详细释义</p>
                    </div>
                )}
            </div>
        </div>
    );
};
