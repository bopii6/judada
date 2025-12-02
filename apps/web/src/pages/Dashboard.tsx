import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useProgressStore, getTodayDailyLog, getUserStats } from "../store/progressStore";
import { fetchPublishedCourses, type CourseSummary } from "../api/courses";
import { SyncStatus } from "../components/SyncStatus";
import { DailyQuestBoard } from "../components/DailyQuestBoard";
import {
  Star,
  TrendingUp,
  BookOpen,
  Clock,
  Flame,
  Award,
  Play,
  ArrowRight,
  Target,
  Zap,
  BarChart3,
  Calendar
} from "lucide-react";

export const Dashboard: React.FC = () => {
  const progress = useProgressStore();
  const today = getTodayDailyLog();
  const userStats = getUserStats();

  // 获取课程列表，用于推荐
  const { data: coursesData } = useQuery({
    queryKey: ["courses"],
    queryFn: () => fetchPublishedCourses()
  });

  const courses = coursesData?.courses ?? [];

  // 计算统计数据
  const stats = useMemo(() => {
    const records = Object.values(progress.stages);
    const totalStars = records.reduce((sum, record) => sum + record.bestStars, 0);
    const totalStages = records.length;
    const totalAttempts = records.reduce((sum, record) => sum + record.attempts, 0);
    
    // 计算最近7天的学习数据
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return {
        date: dateKey,
        dateLabel: i === 0 ? "今天" : i === 1 ? "昨天" : `${i + 1}天前`,
        log: progress.daily[dateKey] || {
          completedStages: 0,
          starsEarned: 0,
          typingStages: 0
        }
      };
    }).reverse();

    // 计算最近学习的课程（基于最后游戏时间）
    const recentCourses = courses
      .filter(course => {
        // 检查是否有该课程的进度记录
        return records.some(r => r.courseId === course.id);
      })
      .slice(0, 3);

    return {
      totalStars: userStats?.totalStars || totalStars,
      totalStages: userStats?.completedStages || totalStages,
      totalAttempts,
      currentStreak: userStats?.currentStreak || 0,
      longestStreak: userStats?.longestStreak || 0,
      last7Days,
      recentCourses,
      todayProgress: {
        completed: today.completedStages,
        stars: today.starsEarned,
        typing: today.typingStages
      }
    };
  }, [progress, userStats, today, courses]);

  // 计算今日完成度百分比
  const todayCompletion = useMemo(() => {
    const tasks = [
      { target: 2, current: stats.todayProgress.completed },
      { target: 5, current: stats.todayProgress.stars },
      { target: 1, current: stats.todayProgress.typing }
    ];
    const totalProgress = tasks.reduce((sum, task) => sum + Math.min(task.current / task.target, 1), 0);
    return Math.round((totalProgress / tasks.length) * 100);
  }, [stats.todayProgress]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <SyncStatus />

      {/* Hero Section - 学习概览 */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 dark:from-indigo-700 dark:via-purple-700 dark:to-pink-600 px-8 py-8 shadow-2xl text-white transition-colors">
        {/* 背景装饰 */}
        <div className="absolute inset-0 opacity-20 dark:opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-xs font-bold backdrop-blur-sm border border-white/20 shadow-sm mb-4">
                <Zap className="w-3.5 h-3.5" />
                <span>学习仪表盘</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 drop-shadow-sm">
                欢迎回来！
              </h1>
              <p className="text-white/90 font-medium text-sm max-w-md">
                继续你的英语学习之旅，每天进步一点点
              </p>
            </div>

            {/* 今日完成度 */}
            <div className="flex flex-col items-center bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 shadow-lg">
              <div className="text-xs font-bold text-white/80 mb-2 uppercase tracking-wider">今日完成度</div>
              <div className="relative w-24 h-24 mb-2">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="white"
                    strokeWidth="8"
                    strokeDasharray={`${todayCompletion * 2.51} 251`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-black">{todayCompletion}%</span>
                </div>
              </div>
              <div className="text-xs font-bold text-white/80">
                {stats.todayProgress.completed} 个关卡完成
              </div>
            </div>
          </div>

          {/* 核心数据卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-yellow-300 fill-current" />
                <span className="text-xs font-bold text-white/80 uppercase tracking-wider">总星星</span>
              </div>
              <div className="text-3xl font-black mb-1">{stats.totalStars}</div>
              <div className="text-xs text-white/70 font-medium">累计获得</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-emerald-300" />
                <span className="text-xs font-bold text-white/80 uppercase tracking-wider">完成关卡</span>
              </div>
              <div className="text-3xl font-black mb-1">{stats.totalStages}</div>
              <div className="text-xs text-white/70 font-medium">已通关</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-5 h-5 text-orange-300 fill-current" />
                <span className="text-xs font-bold text-white/80 uppercase tracking-wider">连续打卡</span>
              </div>
              <div className="text-3xl font-black mb-1">{stats.currentStreak}</div>
              <div className="text-xs text-white/70 font-medium">
                最长 {stats.longestStreak} 天
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-300" />
                <span className="text-xs font-bold text-white/80 uppercase tracking-wider">总练习</span>
              </div>
              <div className="text-3xl font-black mb-1">{stats.totalAttempts}</div>
              <div className="text-xs text-white/70 font-medium">累计尝试</div>
            </div>
          </div>
        </div>
      </section>

      {/* 主要内容区域 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：每日任务 + 学习趋势 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 每日任务 */}
          <DailyQuestBoard />

          {/* 学习趋势图表 */}
          <section className="rounded-[2rem] bg-white dark:bg-slate-800 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">学习趋势</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">最近7天的学习数据</p>
                </div>
              </div>
            </div>

            {/* 简化的柱状图 */}
            <div className="flex items-end justify-between gap-2 h-48">
              {stats.last7Days.map((day, index) => {
                const maxValue = Math.max(...stats.last7Days.map(d => d.log.completedStages), 1);
                const height = (day.log.completedStages / maxValue) * 100;
                const isToday = index === stats.last7Days.length - 1;

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                    <div className="relative w-full flex items-end justify-center" style={{ height: "160px" }}>
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 ${
                          isToday
                            ? "bg-gradient-to-t from-indigo-500 to-purple-500"
                            : "bg-gradient-to-t from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700"
                        }`}
                        style={{ height: `${Math.max(height, 5)}%` }}
                      />
                    </div>
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300 text-center">
                      {day.log.completedStages}
                    </div>
                    <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 text-center whitespace-nowrap">
                      {day.dateLabel}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 图例 */}
            <div className="mt-6 flex items-center justify-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-indigo-500" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">今日</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-slate-300 dark:bg-slate-600" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">历史</span>
              </div>
            </div>
          </section>
        </div>

        {/* 右侧：最近学习 + 推荐课程 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 最近学习 */}
          {stats.recentCourses.length > 0 && (
            <section className="rounded-[2rem] bg-white dark:bg-slate-800 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400">
                  <Clock className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">最近学习</h2>
              </div>
              <div className="space-y-3">
                {stats.recentCourses.map((course) => {
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
                      className="group block p-4 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center shrink-0">
                          <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {course.title}
                          </h3>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{progressPercent}%</span>
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                            {completedCount} / {course.lessonCount} 关卡
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* 推荐课程 */}
          {courses.length > 0 && (
            <section className="rounded-[2rem] bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6 border border-indigo-100 dark:border-indigo-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-indigo-500 text-white">
                  <Award className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">推荐课程</h2>
              </div>
              <div className="space-y-3">
                {courses.slice(0, 2).map((course) => {
                  const hasProgress = Object.values(progress.stages).some(r => r.courseId === course.id);
                  
                  return (
                    <Link
                      key={course.id}
                      to={`/courses/${course.id}`}
                      className="group block p-4 rounded-xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start gap-3">
                        {course.coverUrl ? (
                          <img
                            src={course.coverUrl}
                            alt={course.title}
                            className="w-12 h-12 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center shrink-0">
                            <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {course.title}
                          </h3>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              {course.lessonCount} 个关卡
                            </span>
                            {hasProgress ? (
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">继续学习</span>
                            ) : (
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">开始学习</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <Link
                to="/courses"
                className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white text-sm font-bold transition-colors"
              >
                浏览更多课程
                <ArrowRight className="w-4 h-4" />
              </Link>
            </section>
          )}

          {/* 快速开始 */}
          <section className="rounded-[2rem] bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-6 border border-orange-100 dark:border-orange-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-orange-500 text-white">
                <Play className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">快速开始</h2>
            </div>
            <div className="space-y-2">
              <Link
                to="/courses"
                className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-orange-100 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-600 hover:shadow-md transition-all group"
              >
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  探索课程
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors" />
              </Link>
              <Link
                to="/lab/music"
                className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-orange-100 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-600 hover:shadow-md transition-all group"
              >
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  音乐闯关
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
