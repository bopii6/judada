import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPublishedCourses, type CourseSummary } from "../api/courses";
import { BookOpen, ArrowRight, Filter, ChevronDown } from "lucide-react";

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
        <h1 className="text-xl sm:text-2xl font-black text-slate-800">探索课程</h1>
        <p className="text-slate-500 text-xs font-medium max-w-2xl">
          选择一个感兴趣的主题，开始你的英语进阶之旅吧！
        </p>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-linear-fade">
          <div className="flex items-center text-slate-400 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-xs font-bold ml-1">筛选</span>
          </div>

          <div className="relative group">
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="appearance-none bg-white pl-3 pr-7 py-1.5 rounded-full text-xs font-bold text-slate-600 shadow-sm border border-slate-100 hover:border-orange-300 hover:text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/10 transition-all cursor-pointer"
            >
              <option value="all">全部年级</option>
              {availableFilters.grades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none group-hover:text-orange-500 transition-colors" />
          </div>

          <div className="relative group">
            <select
              value={selectedPublisher}
              onChange={(e) => setSelectedPublisher(e.target.value)}
              className="appearance-none bg-white pl-3 pr-7 py-1.5 rounded-full text-xs font-bold text-slate-600 shadow-sm border border-slate-100 hover:border-orange-300 hover:text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/10 transition-all cursor-pointer"
            >
              <option value="all">全部出版社</option>
              {availableFilters.publishers.map((publisher) => (
                <option key={publisher} value={publisher}>
                  {publisher}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none group-hover:text-orange-500 transition-colors" />
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-2 py-1.5 rounded-full text-[10px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              清除
            </button>
          )}
        </div>

        <div className="bg-slate-100 px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-400">
          共 {courses.length} 个课程
        </div>
      </div>

      {/* 课程列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-10">
        {courses.map((course, index) => (
          <Link
            key={course.id}
            to={`/courses/${course.id}`}
            className="group relative flex flex-col bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md hover:border-orange-200 hover:-translate-y-1 transition-all duration-300"
          >
            {/* 封面图 */}
            <div className="relative aspect-video overflow-hidden bg-slate-100 m-2 rounded-lg">
              {course.coverUrl ? (
                <img
                  src={course.coverUrl}
                  alt={course.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div
                  className={`h-full w-full flex items-center justify-center bg-gradient-to-br ${
                    index % 3 === 0
                      ? "from-sky-100 to-blue-50 text-sky-400"
                      : index % 3 === 1
                        ? "from-orange-100 to-amber-50 text-orange-400"
                        : "from-violet-100 to-purple-50 text-violet-400"
                  }`}
                >
                  <BookOpen className="w-10 h-10 opacity-50" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* 标签区域 */}
              <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
                {course.grade && (
                  <span className="rounded-md bg-white/95 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-indigo-600 shadow-sm border border-indigo-50">
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
              <h3 className="text-sm font-bold text-slate-800 mb-0.5 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                {course.title}
              </h3>

              <p className="text-[10px] text-slate-500 font-medium line-clamp-2 mb-2 flex-1 leading-relaxed">
                {course.description || "暂无简介，快去探索吧！"}
              </p>

              {/* 底部信息 */}
              <div className="mt-auto flex items-center justify-between border-t border-slate-50 pt-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                  <span>{course.unitCount ? `${course.unitCount} 个单元` : course.topic || "General"}</span>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-[10px] font-bold text-white transition-colors group-hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-slate-900"
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
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center rounded-[2rem] bg-white border border-slate-100 border-dashed">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
              <BookOpen className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">
              {hasFilters ? "没有匹配的课程" : "暂无课程"}
            </h3>
            <p className="text-slate-500">
              {hasFilters ? "试试调整筛选条件" : "管理员还没有发布任何课程哦～"}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                清除筛选
              </button>
            )}
          </div>
        )}

        {isLoading && (
          <div className="col-span-full py-20 text-center text-slate-400 font-medium">
            正在加载精彩课程...
          </div>
        )}
      </div>
    </div>
  );
};
