import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Play, Clock, ArrowLeft, Star } from "lucide-react";
import classNames from "classnames";
import { fetchMusicTracks } from "../../api/music";
import { MusicCover } from "../../components/MusicCover";
import { Mascot } from "../../components/Mascot";

const formatTrackDuration = (durationMs?: number | null) => {
    if (!durationMs) return "--";
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60)
        .toString()
        .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
};

const getSmartCoverUrl = (track: { title: string; coverUrl?: string | null; slug: string }) => {
    if (track.coverUrl) return track.coverUrl;

    const title = track.title.toLowerCase();

    // Baby Shark / Shark Family
    if (title.includes("shark") || title.includes("鲨鱼")) {
        return "https://images.unsplash.com/photo-1551244072-5d12893278ab?q=80&w=1000&auto=format&fit=crop";
    }

    // Twinkle Twinkle Little Star
    if (title.includes("star") || title.includes("twinkle") || title.includes("星星")) {
        return "https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?q=80&w=1000&auto=format&fit=crop";
    }

    // Alphabet Song / ABC
    if (title.includes("alphabet") || title.includes("abc") || title.includes("字母")) {
        return "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=1000&auto=format&fit=crop";
    }

    // Default Music / Happy theme
    return "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=1000&auto=format&fit=crop";
};

export const MusicLevelSelectionPage = () => {
    const { data: tracks = [], isLoading, error } = useQuery({
        queryKey: ["lab-music-tracks"],
        queryFn: fetchMusicTracks
    });

    return (
        <div className="min-h-screen w-full bg-cream text-slate-800 font-sans selection:bg-bubblegum/30 selection:text-slate-900 overflow-x-hidden">
            {/* Cute Background Blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-bubblegum/20 blur-[100px] animate-blob" />
                <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-sunshine/20 blur-[100px] animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[60%] rounded-full bg-sky/20 blur-[100px] animate-blob animation-delay-4000" />
            </div>

            {/* Mascot Guide */}
            <Mascot />

            <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-12">
                {/* Hero Header - Playful & Bouncy */}
                <header className="mb-16 flex flex-col items-center text-center space-y-6">
                    <Link
                        to="/lab"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border-2 border-indigo-100 text-indigo-400 hover:text-indigo-600 hover:border-indigo-200 hover:scale-105 transition-all duration-300 font-bold text-sm shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Lab</span>
                    </Link>

                    <div className="relative">
                        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-800 drop-shadow-sm">
                            <span className="inline-block hover:animate-bounce text-bubblegum">M</span>
                            <span className="inline-block hover:animate-bounce animation-delay-100 text-sunshine">u</span>
                            <span className="inline-block hover:animate-bounce animation-delay-200 text-mint">s</span>
                            <span className="inline-block hover:animate-bounce animation-delay-300 text-sky">i</span>
                            <span className="inline-block hover:animate-bounce animation-delay-400 text-bubblegum">c</span>
                            <span className="inline-block w-4"></span>
                            <span className="inline-block hover:animate-bounce animation-delay-500 text-slate-700">Adventure</span>
                        </h1>
                        <div className="absolute -top-6 -right-8 text-4xl animate-bounce duration-[3000ms]">🎵</div>
                        <div className="absolute -bottom-4 -left-6 text-4xl animate-bounce duration-[2500ms]">✨</div>
                    </div>

                    <p className="text-xl text-slate-500 font-bold max-w-lg">
                        Pick a song and start your magical learning journey!
                    </p>
                </header>

                {/* Content Grid - Sticker Cards */}
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 px-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="aspect-[4/5] rounded-[2.5rem] bg-white border-4 border-slate-100 shadow-sm animate-pulse" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center p-20 rounded-[3rem] bg-white border-4 border-rose-100 shadow-xl shadow-rose-100/50 max-w-2xl mx-auto">
                        <div className="text-6xl mb-6">🙈</div>
                        <p className="text-rose-500 font-bold text-2xl mb-4">Oops! Something went wrong.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-8 py-3 rounded-full bg-rose-400 text-white font-bold shadow-lg shadow-rose-200 hover:scale-105 hover:shadow-xl transition-all"
                        >
                            Try Again
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 px-4 pb-20">
                        {tracks.map((track, index) => (
                            <Link
                                key={track.id}
                                to={`/lab/music/${track.slug}`}
                                className="group relative flex flex-col p-4 bg-white rounded-[2.5rem] border-[6px] border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:shadow-indigo-100/50 transition-all duration-500 hover:-translate-y-2 hover:rotate-1"
                                style={{
                                    animationDelay: `${index * 100}ms`
                                }}
                            >
                                {/* Cover Art Area */}
                                <div className="relative aspect-square rounded-[2rem] mb-5 transition-transform duration-500 group-hover:scale-105">
                                    <MusicCover
                                        url={getSmartCoverUrl(track)}
                                        title={track.title}
                                        size="xl"
                                        className="w-full h-full shadow-md group-hover:shadow-xl transition-shadow duration-500"
                                    />

                                    {/* Play Overlay - Jelly Button */}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="w-20 h-20 rounded-full bg-white text-bubblegum flex items-center justify-center shadow-lg transform scale-50 group-hover:scale-100 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer">
                                            <Play className="w-8 h-8 ml-1 fill-current" />
                                        </div>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="flex-1 flex flex-col px-3 pb-2 text-center">
                                    <h3 className="text-2xl font-black text-slate-800 mb-1 line-clamp-1 group-hover:text-bubblegum transition-colors">
                                        {track.title}
                                    </h3>
                                    <p className="text-slate-400 font-bold text-sm mb-4 line-clamp-1">
                                        {track.artist || "Unknown Artist"}
                                    </p>

                                    <div className="mt-auto flex items-center justify-center gap-4">
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>{formatTrackDuration(track.durationMs)}</span>
                                        </div>

                                        {/* Star Rating (Gamification Mock) */}
                                        <div className="flex gap-0.5 text-sunshine">
                                            <Star className="w-4 h-4 fill-current" />
                                            <Star className="w-4 h-4 fill-current" />
                                            <Star className="w-4 h-4 fill-current opacity-30" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
