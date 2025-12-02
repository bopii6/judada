import React from "react";
import classNames from "classnames";
import { format, subDays, eachDayOfInterval, isSameDay } from "date-fns";

interface ActivityGardenProps {
    className?: string;
}

// Mock data generator for demonstration
const generateMockActivity = (days: number) => {
    const today = new Date();
    const data: Record<string, number> = {};

    for (let i = 0; i < days; i++) {
        const date = subDays(today, i);
        const dateStr = format(date, "yyyy-MM-dd");

        // Random activity level: 0-4
        // Bias towards 0 and 1 for realism
        const rand = Math.random();
        let level = 0;
        if (rand > 0.7) level = 1;
        if (rand > 0.85) level = 2;
        if (rand > 0.92) level = 3;
        if (rand > 0.96) level = 4;

        data[dateStr] = level;
    }
    return data;
};

export const ActivityGarden: React.FC<ActivityGardenProps> = ({ className }) => {
    const today = new Date();
    const startDate = subDays(today, 27); // Show last 4 weeks (28 days)

    // Generate mock data
    const activityData = React.useMemo(() => generateMockActivity(30), []);

    const days = eachDayOfInterval({ start: startDate, end: today });

    const getGrowthStage = (level: number) => {
        if (level === 0) return "🌱"; // Grass/Seed
        if (level === 1) return "🌿"; // Sprout
        if (level === 2) return "🌷"; // Bud
        if (level === 3) return "🌸"; // Flower
        return "🌻"; // Big Flower
    };

    const getTooltip = (level: number, date: Date) => {
        const dateStr = format(date, "MMM d");
        if (level === 0) return `${dateStr}: No activity`;
        return `${dateStr}: ${level} levels completed!`;
    };

    return (
        <div className={classNames("bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100", className)}>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <span className="text-3xl">🏡</span>
                    My Learning Garden
                </h2>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                    <span>Last 28 Days</span>
                </div>
            </div>

            {/* Garden Grid */}
            <div className="grid grid-cols-7 gap-3 sm:gap-4">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="text-center text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        {day}
                    </div>
                ))}

                {days.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const level = activityData[dateStr] || 0;
                    const isToday = isSameDay(day, today);

                    return (
                        <div
                            key={dateStr}
                            className="group relative aspect-square"
                        >
                            <div
                                className={classNames(
                                    "w-full h-full rounded-2xl flex items-center justify-center text-2xl transition-all duration-300 cursor-default border-2",
                                    level === 0 ? "bg-emerald-50 border-emerald-100 text-emerald-200/50" :
                                        level === 1 ? "bg-emerald-100 border-emerald-200 text-emerald-600" :
                                            level === 2 ? "bg-orange-100 border-orange-200 text-orange-600" :
                                                level === 3 ? "bg-amber-100 border-amber-200 text-amber-600" :
                                                    "bg-pink-100 border-pink-200 text-pink-600 shadow-md shadow-pink-100",
                                    isToday && "ring-4 ring-yellow-200 ring-offset-2"
                                )}
                            >
                                <span className="transform group-hover:scale-125 transition-transform duration-300 filter drop-shadow-sm">
                                    {getGrowthStage(level)}
                                </span>
                            </div>

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">
                                {getTooltip(level, day)}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="mt-8 flex items-center justify-center gap-6 text-sm font-bold text-slate-400">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🌱</span>
                    <span>Rest</span>
                </div>
                <div className="w-12 h-1 bg-slate-100 rounded-full" />
                <div className="flex items-center gap-2">
                    <span className="text-lg">🌻</span>
                    <span>Grow</span>
                </div>
            </div>
        </div>
    );
};
