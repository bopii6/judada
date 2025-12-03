import React from "react";
import { useProgressStore } from "../../store/progressStore";
import { CheckCircle2, Star, Clock, Calendar } from "lucide-react";

export const LearningTimeline: React.FC = () => {
    const progress = useProgressStore();

    // Convert daily logs to array and sort by date (newest first)
    const timelineData = Object.entries(progress.daily)
        .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
        .map(([date, log]) => {
            const dateObj = new Date(date);
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            let dateLabel = date;
            if (dateObj.toDateString() === today.toDateString()) {
                dateLabel = "今天";
            } else if (dateObj.toDateString() === yesterday.toDateString()) {
                dateLabel = "昨天";
            } else {
                dateLabel = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
            }

            return {
                dateLabel,
                ...log
            };
        });

    // If no data, show empty state
    if (timelineData.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 text-center border border-slate-100 dark:border-slate-700">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">暂无学习记录</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">快去开始第一节课的学习吧！</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 md:p-8 border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400">
                    <Clock className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">学习足迹</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">记录宝贝成长的每一步</p>
                </div>
            </div>

            <div className="relative pl-4 space-y-8 before:absolute before:left-[19px] before:top-2 before:bottom-4 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-700">
                {timelineData.map((item, index) => (
                    <div key={item.date} className="relative pl-8 group">
                        {/* Timeline Dot */}
                        <div className={`absolute left-0 top-0 w-10 h-10 rounded-full border-4 border-white dark:border-slate-800 flex items-center justify-center z-10 transition-colors ${index === 0
                                ? "bg-blue-500 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20"
                                : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                            }`}>
                            {index === 0 ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-3 h-3 rounded-full bg-current" />}
                        </div>

                        {/* Content */}
                        <div>
                            <div className="flex items-baseline gap-3 mb-2">
                                <h3 className={`text-lg font-bold ${index === 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-200"}`}>
                                    {item.dateLabel}
                                </h3>
                                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                                    {new Date(item.date).getFullYear()}年
                                </span>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-700/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                                <div className="flex flex-wrap gap-4">
                                    {item.completedStages > 0 && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                    完成 {item.completedStages} 个关卡
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {item.starsEarned > 0 && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
                                                <Star className="w-4 h-4 fill-current" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                    获得 {item.starsEarned} 颗星星
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {item.typingStages > 0 && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                                <span className="text-xs font-black">Aa</span>
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                    练习 {item.typingStages} 次打字
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
