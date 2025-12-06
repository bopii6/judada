import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useProgressStore } from "../store/progressStore";
import { useQuery } from "@tanstack/react-query";
import { fetchPublishedCourses } from "../api/courses";
import {
    BookOpen,
    ChevronRight,
    Calendar,
    TrendingUp,
    Clock
} from "lucide-react";

export const ParentLearningReport: React.FC = () => {
    const progress = useProgressStore();

    // 获取课程列表
    const { data: coursesData } = useQuery({
        queryKey: ["courses"],
        queryFn: () => fetchPublishedCourses()
    });

    const courses = useMemo(() => coursesData?.courses ?? [], [coursesData]);

    // 计算本周数据
    const weeklyData = useMemo(() => {
        const now = new Date();
        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(now.getDate() - now.getDay());
        currentWeekStart.setHours(0, 0, 0, 0);

        // 统计本周学习天数
        let learningDays = 0;
        const thisWeekCourses = new Set<string>();

        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + i);
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

            const dayLog = progress.daily[dateKey];
            if (dayLog && dayLog.completedStages > 0) {
                learningDays++;
            }

            // 收集本周学习的课程
            Object.values(progress.stages).forEach(stage => {
                const stageDate = stage.lastPlayedAt ? new Date(stage.lastPlayedAt) : null;
                if (stageDate && stageDate >= currentWeekStart && stageDate <= now) {
                    if (stage.courseId) {
                        thisWeekCourses.add(stage.courseId);
                    }
                }
            });
        }

        return {
            weekNumber: Math.ceil(now.getDate() / 7),
            month: now.getMonth() + 1,
            learningDays,
            coursesCount: thisWeekCourses.size,
            courseIds: Array.from(thisWeekCourses)
        };
    }, [progress]);

    // 获取正在学习的课程详情
    const activeCourses = useMemo(() => {
        return courses
            .filter(course => {
                // 有进度记录的课程
                return Object.values(progress.stages).some(r => r.courseId === course.id);
            })
            .map(course => {
                const courseStages = Object.values(progress.stages).filter(
                    r => r.courseId === course.id
                );

                // 计算总进度
                const totalProgress = courseStages.length;
                const totalLessons = course.lessonCount || 0;
                const progressPercent = totalLessons > 0
                    ? Math.round((totalProgress / totalLessons) * 100)
                    : 0;

                // 找出当前单元（最近学习的）
                const recentStage = courseStages.sort((a, b) => {
                    const dateA = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : 0;
                    const dateB = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : 0;
                    return dateB - dateA;
                })[0];

                // 本周在这门课程的学习
                const thisWeekStages = courseStages.filter(stage => {
                    const stageDate = stage.lastPlayedAt ? new Date(stage.lastPlayedAt) : null;
                    if (!stageDate) return false;

                    const now = new Date();
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - now.getDay());
                    weekStart.setHours(0, 0, 0, 0);

                    return stageDate >= weekStart && stageDate <= now;
                });

                return {
                    course,
                    totalProgress,
                    totalLessons,
                    progressPercent,
                    currentUnit: recentStage?.unitNumber || null,
                    currentUnitName: recentStage?.unitName || null,
                    thisWeekCount: thisWeekStages.length,
                    lastStudied: recentStage?.lastPlayedAt || null
                };
            })
            .sort((a, b) => {
                // 按最近学习时间排序
                const dateA = a.lastStudied ? new Date(a.lastStudied).getTime() : 0;
                const dateB = b.lastStudied ? new Date(b.lastStudied).getTime() : 0;
                return dateB - dateA;
            })
            .slice(0, 3); // 只显示最近的3门课程
    }, [courses, progress]);

    return (
        <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* 本周概览 - 紧凑横条 */}
            <div className="bg-slate-50 dark:bg-slate-900 px-6 py-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                本周学习 · {weeklyData.month}月第{weeklyData.weekNumber}周
                            </span>
                        </div>
                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-600" />
                        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                            <span>学习 <strong className="text-slate-800 dark:text-slate-100">{weeklyData.learningDays}</strong> 天</span>
                            <span>练习 <strong className="text-slate-800 dark:text-slate-100">{weeklyData.coursesCount}</strong> 门课程</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 正在学习的课程 */}
            <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                        正在学习的课程
                    </h3>
                </div>

                {activeCourses.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <p className="text-sm">还没有开始学习课程</p>
                        <Link
                            to="/courses"
                            className="inline-flex items-center gap-1 mt-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            浏览课程 <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {activeCourses.map(({ course, totalProgress, totalLessons, progressPercent, currentUnit, currentUnitName, thisWeekCount }) => (
                            <div
                                key={course.id}
                                className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                            >
                                {/* 课程头部 */}
                                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                                    📚 {course.publisher || "教材"}
                                                    {course.grade && ` · ${course.grade}`}
                                                    {course.semester && ` · ${course.semester}`}
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                {course.title}
                                            </h4>
                                        </div>
                                        <Link
                                            to={`/courses/${course.id}`}
                                            className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                                        >
                                            查看详情 <ChevronRight className="w-3 h-3" />
                                        </Link>
                                    </div>
                                </div>

                                {/* 课程内容 */}
                                <div className="p-4 space-y-3">
                                    {/* 当前单元 */}
                                    {currentUnit && (
                                        <div>
                                            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                当前学习
                                            </div>
                                            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                Unit {currentUnit}{currentUnitName && ` - ${currentUnitName}`}
                                            </div>
                                        </div>
                                    )}

                                    {/* 进度条 */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                                课程进度
                                            </div>
                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {totalProgress} / {totalLessons} 课时 · {progressPercent}%
                                            </div>
                                        </div>
                                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-300"
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* 本周学习 */}
                                    {thisWeekCount > 0 && (
                                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                                            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                                            <span className="text-xs text-slate-600 dark:text-slate-400">
                                                本周练习了 <strong className="text-slate-800 dark:text-slate-100">{thisWeekCount}</strong> 个课时
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 查看更多课程 */}
                {activeCourses.length > 0 && (
                    <div className="mt-4 text-center">
                        <Link
                            to="/courses"
                            className="inline-flex items-center gap-1 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                        >
                            查看所有课程 <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                )}
            </div>

            {/* 学习建议 */}
            {weeklyData.learningDays < 5 && activeCourses.length > 0 && (
                <div className="px-6 pb-6">
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">
                                    学习建议
                                </h4>
                                <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                                    本周已学习 {weeklyData.learningDays} 天，建议保持每周至少 5 天的学习频率，更有助于知识巩固。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};
