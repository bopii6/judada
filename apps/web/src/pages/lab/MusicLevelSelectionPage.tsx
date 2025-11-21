import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Play, Clock, ArrowLeft } from "lucide-react";
import classNames from "classnames";
import { fetchMusicTracks } from "../../api/music";
import { MusicCover } from "../../components/MusicCover";

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
        <div className="min-h-screen w-full bg-[#F8F9FA] text-slate-900 font-sans selection:bg-indigo-500/20 selection:text-indigo-900">
            {/* Premium Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-indigo-100/40 to-purple-100/40 blur-[120px] mix-blend-multiply animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-gradient-to-tl from-blue-100/40 to-cyan-100/40 blur-[120px] mix-blend-multiply animate-pulse delay-1000" />
            </div>

            <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-16">
                {/* Hero Header - Simplified */}
                <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-4 max-w-2xl">
                        <Link
                            to="/lab"
                            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors font-medium text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>返回实验室</span>
                        </Link>
                        <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
                            听歌
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                                闯关
                            </span>
                        </h1>
                    </div>
                </header>

                {/* Content Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="aspect-[4/5] rounded-[2.5rem] bg-white shadow-sm animate-pulse" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center p-20 rounded-[3rem] bg-white border border-slate-100 shadow-xl shadow-slate-200/50">
                        <p className="text-rose-600 font-bold text-lg">Unable to load your library.</p>
                        <button onClick={() => window.location.reload()} className="mt-4 text-slate-500 underline hover:text-slate-800">Try Again</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {tracks.map((track) => (
                            <Link
                                key={track.id}
                                to={`/lab/music/${track.slug}`}
                                className="group relative flex flex-col p-5 bg-white rounded-[2.5rem] shadow-[0_2px_20px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-500 hover:-translate-y-2 ring-1 ring-slate-100 hover:ring-indigo-100"
                            >
                                {/* Cover Art Area */}
                                <div className="relative aspect-square rounded-[2rem] overflow-hidden mb-6 shadow-md group-hover:shadow-xl transition-all duration-500">
                                    <MusicCover
                                        url={getSmartCoverUrl(track)}
                                        title={track.title}
                                        size="xl"
                                        className="w-full h-full"
                                    />

                                    {/* Play Overlay */}
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                        <div className="w-16 h-16 rounded-full bg-white/90 text-indigo-600 flex items-center justify-center shadow-2xl transform scale-50 group-hover:scale-100 transition-transform duration-300">
                                            <Play className="w-7 h-7 ml-1 fill-current" />
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    {track.status !== 'published' && (
                                        <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider border border-white/20">
                                            {track.status}
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 flex flex-col px-2">
                                    <h3 className="text-xl font-bold text-slate-900 mb-1 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                                        {track.title}
                                    </h3>
                                    <p className="text-slate-500 font-medium text-sm mb-4 line-clamp-1">
                                        {track.artist || "Unknown Artist"}
                                    </p>

                                    <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>{formatTrackDuration(track.durationMs)}</span>
                                        </div>

                                        {/* Difficulty Indicator (Mock) */}
                                        <div className="flex gap-0.5">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className={classNames(
                                                    "w-1.5 h-4 rounded-full",
                                                    i <= 2 ? "bg-indigo-300" : "bg-slate-200"
                                                )} />
                                            ))}
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
