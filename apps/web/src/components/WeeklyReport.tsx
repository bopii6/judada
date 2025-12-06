import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useProgressStore } from "../store/progressStore";
import { useQuery } from "@tanstack/react-query";
import { fetchPublishedCourses } from "../api/courses";
import {
    Calendar,
    Star,
    Award,
    BookOpen,
    Clock,
    ArrowRight,
    CheckCircle2
} from "lucide-react";

export const WeeklyReport: React.FC = () => {
    const progress = useProgressStore();

    // 获取课程列表
    const { data: coursesData } = useQuery({
        queryKey: ["courses"],
        queryFn: () => fetchPublishedCourses()
    });

    const courses = useMemo(() => coursesData?.courses ?? [], [coursesData]);

    // 计算本周和上周的统计数据
    const weeklyStats = useMemo(() => {
        const now = new Date();
        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(now.getDate() - now.getDay()); // 本周日
        currentWeekStart.setHours(0, 0, 0, 0);

        const lastWeekStart = new Date(currentWeekStart);
        lastWeekStart.setDate(currentWeekStart.getDate() - 7);

        const getWeekStats = (weekStart: Date) => {
            let completedStages = 0;
            let starsEarned = 0;
            let learningDays = 0;
            const coursesThisWeek = new Set<string>();

            for (let i = 0; i < 7; i++) {
                const date = new Date(weekStart);
                date.setDate(weekStart.getDate() + i);
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

                const dayLog = progress.daily[dateKey];
                if (dayLog) {
                    completedStages += dayLog.completedStages || 0;
                    starsEarned += dayLog.starsEarned || 0;
                    if (dayLog.completedStages > 0) {
                        learningDays++;
                    }
                }

                // 收集本周学习的课程
                Object.values(progress.stages).forEach(stage => {
                    const stageDate = stage.lastPlayedAt ? new Date(stage.lastPlayedAt) : null;
                    if (stageDate && stageDate >= weekStart && stageDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)) {
                        if (stage.courseId) {
                            coursesThisWeek.add(stage.courseId);
                        }
                    }
                });
            }

            return {
                completedStages,
                starsEarned,
                learningDays,
                coursesCount: coursesThisWeek.size,
                courseIds: Array.from(coursesThisWeek)
            };
        };

        const thisWeek = getWeekStats(currentWeekStart);
        const lastWeek = getWeekStats(lastWeekStart);

        // 计算增长
        const stagesGrowth = lastWeek.completedStages > 0
            ? Math.round(((thisWeek.completedStages - lastWeek.completedStages) / lastWeek.completedStages) * 100)
            : thisWeek.completedStages > 0 ? 100 : 0;

        const starsGrowth = lastWeek.starsEarned > 0
            ? Math.round(((thisWeek.starsEarned - lastWeek.starsEarned) / lastWeek.starsEarned) * 100)
            : thisWeek.starsEarned > 0 ? 100 : 0;

        // 获取本周学习的课程详情
        const weekCourses = courses.filter(c => thisWeek.courseIds.includes(c.id));

        return {
            thisWeek,
            lastWeek,
            stagesGrowth,
            starsGrowth,
            weekCourses
        };
    }, [progress, courses]);

    return (
        <section className="rounded-[2rem] bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 border border-blue-100 dark:border-blue-800">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-blue-500 text-white">
                    <Calendar className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">本周学习报告</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        {new Date().getMonth() + 1}月第{Math.ceil(new Date().getDate() / 7)}周
                    </p>
                </div>
            </div>

            {/* 本周核心数据 */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">完成关卡</span>
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
                            {weeklyStats.thisWeek.completedStages}
                        </span>
                        {weeklyStats.stagesGrowth !== 0 && (
                            <span className={`text-xs font-bold mb-1 ${weeklyStats.stagesGrowth > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {weeklyStats.stagesGrowth > 0 ? '↑' : '↓'} {Math.abs(weeklyStats.stagesGrowth)}%
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                        上周: {weeklyStats.lastWeek.completedStages}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">获得星星</span>
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
                            {weeklyStats.thisWeek.starsEarned}
                        </span>
                        {weeklyStats.starsGrowth !== 0 && (
                            <span className={`text-xs font-bold mb-1 ${weeklyStats.starsGrowth > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {weeklyStats.starsGrowth > 0 ? '↑' : '↓'} {Math.abs(weeklyStats.starsGrowth)}%
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                        上周: {weeklyStats.lastWeek.starsEarned}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">学习天数</span>
                    </div>
                    <div className="text-2xl font-black text-slate-800 dark:text-slate-100">
                        {weeklyStats.thisWeek.learningDays}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                        / 7 天
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">学习课程</span>
                    </div>
                    <div className="text-2xl font-black text-slate-800 dark:text-slate-100">
                        {weeklyStats.thisWeek.coursesCount}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                        个课程
                    </div>
                </div>
            </div>

            {/* 本周学习的课程列表 */}
            {weeklyStats.weekCourses.length > 0 && (
                <div className="mb-4">
                    <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-3">本周练习的课程</h3>
                    <div className="space-y-2">
                        {weeklyStats.weekCourses.map((course) => {
                            const courseProgress = Object.values(progress.stages).filter(
                                r => r.courseId === course.id
                            );
                            const completedCount = courseProgress.length;
                            const progressPercent = course.lessonCount > 0
                                ? Math.round((completedCount / course.lessonCount) * 100)
                                : 0;

                            return (
                                <Link
                                    key={course.id}
                                    to={`/courses/${course.id}`}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-600 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center shrink-0">
                                        <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {course.title}
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{progressPercent}%</span>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 学习建议 */}
            {weeklyStats.thisWeek.learningDays < 5 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <Award className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">学习提示</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                                本周已学习 {weeklyStats.thisWeek.learningDays} 天，建议每周至少学习 5 天以保持良好的学习习惯！
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {weeklyStats.thisWeek.learningDays >= 7 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <Award className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-green-900 dark:text-green-100 mb-1">太棒了！🎉</h4>
                            <p className="text-xs text-green-700 dark:text-green-300 leading-relaxed">
                                本周完成了 7 天满勤学习！这是非常好的学习习惯，继续保持！
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};
