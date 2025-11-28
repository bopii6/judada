import React, { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, ChevronRight, ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchMusicTracks } from "../../api/music";
import { MusicCover } from "../../components/MusicCover";
import { SAMPLE_TRACK } from "../../data/songs";

export const MusicLevelSelectionPage = () => {
    const navigate = useNavigate();
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Force refresh: Horizontal Adventure Layout
    console.log("MusicLevelSelectionPage loaded");

    const { data: tracks = [] } = useQuery({
        queryKey: ["lab-music-tracks"],
        queryFn: fetchMusicTracks
    });

    const displayTracks = tracks.length > 0 ? tracks : [SAMPLE_TRACK];

    const scroll = (direction: "left" | "right") => {
        if (scrollContainerRef.current) {
            const scrollAmount = 340; // Card width + gap
            scrollContainerRef.current.scrollBy({
                left: direction === "right" ? scrollAmount : -scrollAmount,
                behavior: "smooth"
            });
        }
    };

    return (
        <div className="min-h-screen w-full bg-gradient-to-r from-sky-200 via-indigo-200 to-purple-200 text-slate-800 font-sans overflow-hidden flex flex-col">
            {/* Background Elements (Parallax-ish) */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[10%] left-[5%] w-32 h-32 bg-white/30 rounded-full blur-3xl" />
                <div className="absolute bottom-[20%] right-[10%] w-64 h-64 bg-yellow-200/20 rounded-full blur-3xl" />
                {/* Ground / Horizon Line */}
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-white/40 to-transparent" />
            </div>

            {/* Header */}
            <header className="relative z-20 px-6 py-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="group flex items-center justify-center w-12 h-12 rounded-full bg-white/80 backdrop-blur-md border border-white/50 shadow-sm hover:shadow-md transition-all duration-300"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600 group-hover:text-slate-900" />
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2 drop-shadow-sm">
                            <span>Adventure Map</span>
                            <span className="text-2xl">🗺️</span>
                        </h1>
                    </div>
                </div>
            </header>

            {/* Horizontal Scroll Container */}
            <main className="flex-1 relative flex items-center">

                {/* Navigation Buttons (Desktop) */}
                <button
                    onClick={() => scroll("left")}
                    className="hidden md:flex absolute left-8 z-30 w-14 h-14 rounded-full bg-white/80 backdrop-blur-md shadow-lg items-center justify-center hover:scale-110 active:scale-95 transition-all text-slate-600 hover:text-indigo-600"
                >
                    <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                    onClick={() => scroll("right")}
                    className="hidden md:flex absolute right-8 z-30 w-14 h-14 rounded-full bg-white/80 backdrop-blur-md shadow-lg items-center justify-center hover:scale-110 active:scale-95 transition-all text-slate-600 hover:text-indigo-600"
                >
                    <ChevronRight className="w-8 h-8" />
                </button>

                {/* Scroll Track */}
                <div
                    ref={scrollContainerRef}
                    className="w-full overflow-x-auto flex items-center gap-8 px-8 md:px-32 py-12 snap-x snap-mandatory no-scrollbar"
                    style={{ scrollPaddingLeft: '50vw' }}
                >
                    {/* Start Marker */}
                    <div className="snap-center shrink-0 flex flex-col items-center justify-center gap-4 w-32 opacity-60">
                        <div className="w-4 h-4 bg-slate-800 rounded-full" />
                        <div className="text-sm font-bold uppercase tracking-widest">Start</div>
                    </div>

                    {displayTracks.map((track, index) => (
                        <div key={track.id} className="snap-center shrink-0 relative group">
                            {/* Connecting Line (Dashed) */}
                            {index < displayTracks.length - 1 && (
                                <div className="absolute top-1/2 left-full w-8 h-1 bg-slate-400/30 -translate-y-1/2 z-0" />
                            )}

                            <Link
                                to={`/lab/music/${track.slug}`}
                                className="block w-[280px] md:w-[320px] transition-transform duration-500 hover:-translate-y-4"
                            >
                                {/* Card / Island */}
                                <div className="bg-white rounded-[2.5rem] p-4 shadow-xl shadow-indigo-900/10 border-[6px] border-white group-hover:shadow-2xl group-hover:shadow-indigo-500/20 transition-all duration-300 relative overflow-hidden">

                                    {/* Level Badge */}
                                    <div className="absolute top-4 left-4 z-20 bg-slate-900 text-white text-xs font-black px-3 py-1 rounded-full shadow-md">
                                        Level {index + 1}
                                    </div>

                                    {/* Cover Art */}
                                    <div className="aspect-square rounded-[2rem] overflow-hidden bg-slate-100 relative mb-4">
                                        <MusicCover
                                            url={track.coverUrl}
                                            title={track.title}
                                            size="xl"
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        />

                                        {/* Play Button Overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/10 backdrop-blur-[1px]">
                                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg transform scale-50 group-hover:scale-100 transition-transform duration-300 text-indigo-600">
                                                <Play className="w-8 h-8 fill-current ml-1" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="text-center space-y-1 pb-2">
                                        <h3 className="text-xl font-black text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                                            {track.title}
                                        </h3>
                                        {track.titleCn && (
                                            <p className="text-base font-medium text-slate-500 line-clamp-1">
                                                {track.titleCn}
                                            </p>
                                        )}

                                        {/* Description / Introduction */}
                                        {track.description && (
                                            <div className="mt-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                                <p className="text-xs text-slate-500 text-left leading-relaxed line-clamp-3 whitespace-pre-wrap font-medium">
                                                    {track.description}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Reflection / Shadow on "Ground" */}
                                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[80%] h-4 bg-black/10 blur-md rounded-[100%] transition-all duration-500 group-hover:w-[60%] group-hover:opacity-50" />
                            </Link>
                        </div>
                    ))}

                    {/* End Marker */}
                    <div className="snap-center shrink-0 flex flex-col items-center justify-center gap-4 w-40 opacity-60 pl-8">
                        <div className="w-16 h-16 rounded-full border-4 border-dashed border-slate-400 flex items-center justify-center">
                            <span className="text-2xl">🔒</span>
                        </div>
                        <div className="text-sm font-bold uppercase tracking-widest text-center">More<br />Coming Soon</div>
                    </div>

                    {/* Padding for right side scroll */}
                    <div className="w-16 shrink-0" />
                </div>
            </main>
        </div>
    );
};
