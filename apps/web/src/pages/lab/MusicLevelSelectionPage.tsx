import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Music, Play, Clock, Mic2 } from "lucide-react";
import classNames from "classnames";
import { fetchMusicTracks } from "../../api/music";

const formatTrackDuration = (durationMs?: number | null) => {
    if (!durationMs) return "--";
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60)
        .toString()
        .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
};

export const MusicLevelSelectionPage = () => {
    const { data: tracks = [], isLoading, error } = useQuery({
        queryKey: ["lab-music-tracks"],
        queryFn: fetchMusicTracks
    });

    return (
        <div className="min-h-screen w-full bg-[#FDFBF9] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-100/40 blur-[120px] mix-blend-multiply animate-pulse" />
                <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-100/40 blur-[120px] mix-blend-multiply animate-pulse delay-1000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[60%] rounded-full bg-pink-100/40 blur-[120px] mix-blend-multiply animate-pulse delay-2000" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <header className="mb-16 text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-100 text-indigo-600 mb-6">
                        <Music className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
                        Music Challenge
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Select a song to start your listening and typing challenge.
                        Master the lyrics and improve your language skills through music.
                    </p>
                </header>

                {/* Content */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="h-64 rounded-[2rem] bg-white/50 animate-pulse" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center p-12 rounded-[2rem] bg-rose-50 border border-rose-100">
                        <p className="text-rose-600 font-medium">Failed to load tracks. Please try again later.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {tracks.map((track) => (
                            <Link
                                key={track.id}
                                to={`/lab/music/${track.slug}`}
                                className="group relative flex flex-col bg-white/80 backdrop-blur-sm rounded-[2rem] border border-white/60 shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                            >
                                {/* Card Content */}
                                <div className="p-8 flex-1 flex flex-col">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                                            <Mic2 className="w-6 h-6" />
                                        </div>
                                        <div className="px-3 py-1 rounded-full bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-500">
                                            {track.status === 'published' ? 'Ready' : 'Draft'}
                                        </div>
                                    </div>

                                    <h3 className="text-2xl font-bold text-slate-900 mb-2 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                                        {track.title}
                                    </h3>
                                    <p className="text-slate-500 font-medium mb-6 line-clamp-1">
                                        {track.artist || "Unknown Artist"}
                                    </p>

                                    <div className="mt-auto flex items-center gap-4 text-sm font-medium text-slate-400">
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="w-4 h-4" />
                                            <span>{formatTrackDuration(track.durationMs)}</span>
                                        </div>
                                        {/* Add more metadata here if available, e.g. difficulty */}
                                    </div>
                                </div>

                                {/* Action Area */}
                                <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between group-hover:bg-indigo-50/50 transition-colors">
                                    <span className="text-sm font-bold uppercase tracking-widest text-slate-400 group-hover:text-indigo-600 transition-colors">
                                        Start Challenge
                                    </span>
                                    <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-900 group-hover:scale-110 transition-transform">
                                        <Play className="w-4 h-4 ml-0.5" />
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
