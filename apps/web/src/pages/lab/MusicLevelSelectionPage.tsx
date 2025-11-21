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

    // Map Configuration
    const ITEM_SPACING = 320; // Vertical space between items
    const WAVE_AMPLITUDE = 180; // Horizontal sway
    const START_OFFSET = 100; // Initial vertical padding

    // Calculate total height
    const totalHeight = (tracks.length * ITEM_SPACING) + START_OFFSET + 200;

    // Generate Winding Path SVG
    const generatePath = () => {
        let path = `M 0 ${START_OFFSET}`; // Start center

        for (let i = 0; i < tracks.length; i++) {
            const y = START_OFFSET + (i * ITEM_SPACING);
            const nextY = START_OFFSET + ((i + 1) * ITEM_SPACING);

            // Determine x positions (0 is center)
            // Pattern: Center -> Right -> Center -> Left -> Center
            const getX = (index: number) => {
                const cycle = index % 4;
                if (cycle === 1) return WAVE_AMPLITUDE;
                if (cycle === 3) return -WAVE_AMPLITUDE;
                return 0;
            };

            const currentX = getX(i);
            const nextX = getX(i + 1);

            // Cubic bezier for smooth curve
            // Control points: vertical out from current, vertical in to next
            const cp1x = currentX;
            const cp1y = y + (ITEM_SPACING / 2);
            const cp2x = nextX;
            const cp2y = y + (ITEM_SPACING / 2);

            if (i < tracks.length - 1) {
                path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${nextX} ${nextY}`;
            }
        }
        return path;
    };

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

            <div className="relative z-10 max-w-[1000px] mx-auto px-6 py-12">
                {/* Header */}
                <header className="mb-8 flex flex-col items-center text-center space-y-6 relative z-20">
                    <Link
                        to="/lab"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border-2 border-indigo-100 text-indigo-400 hover:text-indigo-600 hover:border-indigo-200 hover:scale-105 transition-all duration-300 font-bold text-sm shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Lab</span>
                    </Link>

                    <div className="relative">
                        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-800 drop-shadow-sm">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-bubblegum to-sky">Adventure Map</span>
                        </h1>
                        <div className="absolute -top-6 -right-8 text-4xl animate-bounce duration-[3000ms]">🗺️</div>
                    </div>
                </header>

                {/* Treasure Map Container */}
                {isLoading ? (
                    <div className="flex justify-center pt-20">
                        <div className="animate-bounce text-4xl">🐻 Loading map...</div>
                    </div>
                ) : error ? (
                    <div className="text-center p-10">
                        <p className="text-rose-500 font-bold">Map lost!</p>
                        <button onClick={() => window.location.reload()} className="mt-4 underline">Retry</button>
                    </div>
                ) : (
                    <div className="relative w-full mx-auto" style={{ height: totalHeight, maxWidth: '600px' }}>
                        {/* Winding Path SVG */}
                        <svg
                            className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full overflow-visible pointer-events-none z-0"
                            style={{ maxWidth: '600px' }}
                        >
                            {/* Dashed Path */}
                            <path
                                d={generatePath()}
                                fill="none"
                                stroke="#E2E8F0"
                                strokeWidth="12"
                                strokeLinecap="round"
                                strokeDasharray="20 20"
                                className="drop-shadow-sm"
                            />
                            <path
                                d={generatePath()}
                                fill="none"
                                stroke="#94A3B8"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray="15 15"
                                className="opacity-50"
                            />
                        </svg>

                        {/* Start Marker */}
                        <div className="absolute left-1/2 -translate-x-1/2 -top-4 z-10 flex flex-col items-center">
                            <div className="w-16 h-16 bg-sunshine rounded-full border-4 border-white shadow-lg flex items-center justify-center animate-bounce">
                                <span className="text-2xl">🚩</span>
                            </div>
                            <span className="font-black text-slate-400 mt-2 bg-white/80 px-3 py-1 rounded-full backdrop-blur-sm">START</span>
                        </div>

                        {/* Track Items */}
                        {tracks.map((track, index) => {
                            // Calculate Position
                            const cycle = index % 4;
                            let xOffset = 0;
                            if (cycle === 1) xOffset = WAVE_AMPLITUDE;
                            if (cycle === 3) xOffset = -WAVE_AMPLITUDE;

                            const topPos = START_OFFSET + (index * ITEM_SPACING);

                            return (
                                <div
                                    key={track.id}
                                    className="absolute left-1/2 -translate-x-1/2 w-64 md:w-72 z-10"
                                    style={{
                                        top: topPos,
                                        transform: `translateX(calc(-50% + ${xOffset}px))`
                                    }}
                                >
                                    <Link
                                        to={`/lab/music/${track.slug}`}
                                        className="group relative flex flex-col bg-white rounded-[2rem] border-[6px] border-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.12)] hover:shadow-indigo-100/50 transition-all duration-500 hover:-translate-y-2 hover:rotate-2 hover:scale-110"
                                    >
                                        {/* Level Number Badge */}
                                        <div className="absolute -top-4 -left-4 w-10 h-10 bg-bubblegum text-white font-black rounded-full border-4 border-white shadow-md flex items-center justify-center z-20 transform -rotate-12 group-hover:rotate-0 transition-transform">
                                            {index + 1}
                                        </div>

                                        {/* Cover */}
                                        <div className="relative aspect-square rounded-[1.5rem] overflow-hidden m-2">
                                            <MusicCover
                                                url={getSmartCoverUrl(track)}
                                                title={track.title}
                                                size="xl"
                                                className="w-full h-full"
                                            />

                                            {/* Play Overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/10 backdrop-blur-[1px]">
                                                <div className="w-14 h-14 rounded-full bg-white text-bubblegum flex items-center justify-center shadow-lg animate-bounce">
                                                    <Play className="w-6 h-6 ml-1 fill-current" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Title */}
                                        <div className="px-4 pb-4 text-center">
                                            <h3 className="text-lg font-black text-slate-800 line-clamp-1 group-hover:text-bubblegum transition-colors">
                                                {track.title}
                                            </h3>
                                            <div className="flex justify-center gap-1 mt-1 text-sunshine">
                                                <Star className="w-3 h-3 fill-current" />
                                                <Star className="w-3 h-3 fill-current" />
                                                <Star className="w-3 h-3 fill-current opacity-30" />
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            );
                        })}

                        {/* End Marker */}
                        <div
                            className="absolute left-1/2 -translate-x-1/2 z-10 flex flex-col items-center"
                            style={{ top: totalHeight - 100 }}
                        >
                            <div className="w-20 h-20 bg-bubblegum rounded-full border-4 border-white shadow-lg flex items-center justify-center animate-pulse">
                                <span className="text-4xl">🏆</span>
                            </div>
                            <span className="font-black text-slate-400 mt-2 bg-white/80 px-3 py-1 rounded-full backdrop-blur-sm">GOAL!</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
