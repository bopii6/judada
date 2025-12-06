import React, { useMemo } from "react";
import { useProgressStore } from "../../store/progressStore";
import { Star, Target, CalendarDays, Share2, Quote } from "lucide-react";

export const WeeklyReportCard: React.FC = () => {
    const progress = useProgressStore();

    const weeklyStats = useMemo(() => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
        startOfWeek.setHours(0, 0, 0, 0);

        let stars = 0;
        let stages = 0;
        let activeDays = 0;

        Object.entries(progress.daily).forEach(([dateStr, log]) => {
            const date = new Date(dateStr);
            if (date >= startOfWeek) {
                stars += log.starsEarned;
                stages += log.completedStages;
                if (log.completedStages > 0 || log.typingStages > 0) {
                    activeDays++;
                }
            }
        });

        return { stars, stages, activeDays };
    }, [progress.daily]);

    const getEncouragement = () => {
        if (weeklyStats.activeDays >= 5) return "太棒了！你是勤奋的小蜜蜂！";
        if (weeklyStats.activeDays >= 3) return "继续保持，你正在稳步前进！";
        return "加油！每天进步一点点！";
    };

    return (
        <div className="relative group">
            {/* Card Container */}
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 relative overflow-hidden">
                {/* Decorative Header */}
                <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30" />

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">本周成绩单</h2>
                            <p className="text-sm font-bold text-orange-500 dark:text-orange-400 uppercase tracking-wider">Weekly Report</p>
                        </div>
                        <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center shadow-sm">
                            <span className="text-2xl">📝</span>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-4 text-center">
                            <div className="flex justify-center mb-2">
                                <Star className="w-6 h-6 text-orange-500 fill-orange-500" />
                            </div>
                            <div className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-1">
                                {weeklyStats.stars}
                            </div>
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">获得星星</div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 text-center">
                            <div className="flex justify-center mb-2">
                                <Target className="w-6 h-6 text-blue-500" />
                            </div>
                            <div className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-1">
                                {weeklyStats.stages}
                            </div>
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">完成关卡</div>
                        </div>

                        <div className="col-span-2 bg-slate-50 dark:bg-slate-700/30 rounded-2xl p-4 flex items-center justify-between px-6">
                            <div className="flex items-center gap-3">
                                <CalendarDays className="w-5 h-5 text-slate-400" />
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">本周学习天数</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{weeklyStats.activeDays}</span>
                                <span className="text-sm font-bold text-slate-400">/ 7天</span>
                            </div>
                        </div>
                    </div>

                    {/* Teacher's Comment Section */}
                    <div className="relative bg-yellow-50 dark:bg-yellow-900/10 rounded-xl p-4 border border-yellow-100 dark:border-yellow-900/30">
                        <Quote className="absolute top-3 left-3 w-4 h-4 text-yellow-400 opacity-50" />
                        <p className="text-center text-sm font-bold text-slate-700 dark:text-slate-300 pt-2 pb-1">
                            &quot;{getEncouragement()}&quot;
                        </p>
                    </div>

                    {/* Share Action */}
                    <button className="w-full mt-6 py-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-slate-200 dark:shadow-slate-900/50">
                        <Share2 className="w-4 h-4" />
                        <span>分享成绩单</span>
                    </button>
                </div>
            </div>

            {/* Decorative Elements behind */}
            <div className="absolute -z-10 top-4 -right-2 w-full h-full bg-slate-100 dark:bg-slate-700 rounded-[2rem] rotate-2" />
        </div>
    );
};
