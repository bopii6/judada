import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPublishedCourses, type CourseSummary } from "../api/courses";
import { BookOpen, ArrowRight, Filter, ChevronDown } from "lucide-react";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

export const Courses = () => {
  const navigate = useNavigate();
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedPublisher, setSelectedPublisher] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["courses", selectedGrade, selectedPublisher],
    queryFn: () =>
      fetchPublishedCourses({
        grade: selectedGrade === "all" ? undefined : selectedGrade,
        publisher: selectedPublisher === "all" ? undefined : selectedPublisher
      })
  });

  const courses = data?.courses ?? [];
  const availableFilters = data?.filters ?? { grades: [], publishers: [] };

  const handleEnterCourse = (course: CourseSummary) => {
    if (course.lessonCount > 0) {
      navigate(`/courses/${course.id}`);
    }
  };

  const hasFilters = selectedGrade !== "all" || selectedPublisher !== "all";

  const clearFilters = () => {
    setSelectedGrade("all");
    setSelectedPublisher("all");
  };

  return (
    <div className="space-y-3 max-w-6xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">探索课程</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium max-w-2xl">
          选择一个感兴趣的主题，开始你的英语进阶之旅吧！
        </p>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-linear-fade">
          <div className="flex items-center text-slate-400 dark:text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-xs font-bold ml-1">筛选</span>
          </div>

          <div className="relative group">
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-800 pl-3 pr-7 py-1.5 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-600 hover:text-orange-600 dark:hover:text-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/10 transition-all cursor-pointer"
            >
              <option value="all">全部年级</option>
              {availableFilters.grades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 dark:text-slate-500 pointer-events-none group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors" />
          </div>

          <div className="relative group">
            <select
              value={selectedPublisher}
              onChange={(e) => setSelectedPublisher(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-800 pl-3 pr-7 py-1.5 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-600 hover:text-orange-600 dark:hover:text-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/10 transition-all cursor-pointer"
            >
              <option value="all">全部出版社</option>
              {availableFilters.publishers.map((publisher) => (
                <option key={publisher} value={publisher}>
                  {publisher}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 dark:text-slate-500 pointer-events-none group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors" />
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-2 py-1.5 rounded-full text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              清除
            </button>
          )}
        </div>

        <div className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-400 dark:text-slate-500">
          共 {courses.length} 个课程
        </div>
      </div>

      {/* 课程列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-10">
        {courses.map((course, index) => (
          <Link
            key={course.id}
            to={`/courses/${course.id}`}
            className="group relative flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-md hover:border-orange-200 dark:hover:border-orange-700 hover:-translate-y-1 transition-all duration-300"
          >
            {/* 封面图 */}
            <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-700 m-2 rounded-lg">
              {course.coverUrl ? (
                <img
                  src={course.coverUrl}
                  alt={course.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div
                  className={`h-full w-full flex items-center justify-center bg-gradient-to-br ${index % 3 === 0
                    ? "from-sky-100 to-blue-50 dark:from-sky-900/30 dark:to-blue-900/30 text-sky-400 dark:text-sky-300"
                    : index % 3 === 1
                      ? "from-orange-100 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 text-orange-400 dark:text-orange-300"
                      : "from-violet-100 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/30 text-violet-400 dark:text-violet-300"
                    }`}
                >
                  <BookOpen className="w-10 h-10 opacity-50" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* 标签区域 */}
              <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
                {course.grade && (
                  <span className="rounded-md bg-white/95 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-orange-600 shadow-sm border border-orange-50">
                    {course.grade}
                  </span>
                )}
                {course.semester && (
                  <span className="rounded-md bg-orange-500/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white shadow-sm border border-orange-400/50">
                    {course.semester}
                  </span>
                )}
              </div>
              <div className="absolute top-2 right-2 rounded-md bg-slate-900/80 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white shadow-sm border border-white/10">
                {course.lessonCount} 节课
              </div>
            </div>

            {/* 内容区域 */}
            <div className="flex flex-1 flex-col p-3 pt-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-0.5 line-clamp-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                {course.title}
              </h3>

              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium line-clamp-2 mb-2 flex-1 leading-relaxed">
                {course.description || "暂无简介，快去探索吧！"}
              </p>

              {/* 底部信息 */}
              <div className="mt-auto flex items-center justify-between border-t border-slate-50 dark:border-slate-700 pt-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                  <span>{course.unitCount ? `${course.unitCount} 个单元` : course.topic || "General"}</span>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md bg-slate-900 dark:bg-slate-700 px-3 py-1.5 text-[10px] font-bold text-white dark:text-slate-100 transition-colors group-hover:bg-orange-600 dark:group-hover:bg-orange-700 disabled:opacity-50 disabled:hover:bg-slate-900 dark:disabled:hover:bg-slate-700"
                  onClick={(e) => {
                    e.preventDefault();
                    handleEnterCourse(course);
                  }}
                  disabled={course.lessonCount === 0}
                >
                  开始学习
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </Link>
        ))}

        {!isLoading && !courses.length && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center rounded-[2rem] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 border-dashed">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4 text-slate-300 dark:text-slate-600">
              <BookOpen className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">
              {hasFilters ? "没有匹配的课程" : "暂无课程"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              {hasFilters ? "试试调整筛选条件" : "管理员还没有发布任何课程哦～"}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                清除筛选
              </button>
            )}
          </div>
        )}

        {isLoading && (
          <div className="col-span-full">
            <LoadingSpinner text="正在加载课程内容..." />
          </div>
        )}
      </div>
    </div>
  );
};
