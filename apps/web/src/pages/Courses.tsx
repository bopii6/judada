import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPublishedCourses, type CourseSummary } from "../api/courses";
import { BookOpen, ArrowRight, Layers, Filter, X } from "lucide-react";

export const Courses = () => {
  const navigate = useNavigate();
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedPublisher, setSelectedPublisher] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: () => fetchPublishedCourses()
  });

  const courses = data?.courses ?? [];
  const filters = data?.filters ?? { grades: [], publishers: [] };

  // 根据筛选条件过滤课程
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      if (selectedGrade && course.grade !== selectedGrade) return false;
      if (selectedPublisher && course.publisher !== selectedPublisher) return false;
      return true;
    });
  }, [courses, selectedGrade, selectedPublisher]);

  const handleEnterCourse = (course: CourseSummary) => {
    navigate(`/courses/${course.id}`);
  };

  const hasFilters = selectedGrade || selectedPublisher;

  const clearFilters = () => {
    setSelectedGrade("");
    setSelectedPublisher("");
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2">

        <h1 className="text-2xl sm:text-3xl font-black text-slate-800">探索课程</h1>
        <p className="text-slate-500 text-sm font-medium max-w-2xl">
          选择一个感兴趣的主题，开始你的英语进阶之旅。每个课程都包含精心设计的关卡。
        </p>
      </div>

      {/* 筛选栏 */}
      {(filters.grades.length > 0 || filters.publishers.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-4 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-slate-400 mr-2">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-bold">筛选</span>
            </div>

            {filters.grades.length > 0 && (
              <div className="relative group">
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="appearance-none pl-4 pr-8 py-2 rounded-full bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:border-orange-300 hover:text-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all cursor-pointer shadow-sm"
                >
                  <option value="">全部年级</option>
                  {filters.grades.map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-orange-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}

            {filters.publishers.length > 0 && (
              <div className="relative group">
                <select
                  value={selectedPublisher}
                  onChange={(e) => setSelectedPublisher(e.target.value)}
                  className="appearance-none pl-4 pr-8 py-2 rounded-full bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:border-orange-300 hover:text-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all cursor-pointer shadow-sm"
                >
                  <option value="">全部出版社</option>
                  {filters.publishers.map(publisher => (
                    <option key={publisher} value={publisher}>{publisher}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-orange-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                清除
              </button>
            )}
          </div>

          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            共 {filteredCourses.length} 个课程
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCourses.map((course, index) => (
          <div
            key={course.id}
            className="group flex flex-col rounded-2xl bg-white p-2 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-slate-100/50 hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300"
          >
            {/* Cover Image Area */}
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-100">
              {course.coverUrl ? (
                <img
                  src={course.coverUrl}
                  alt={course.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className={`h-full w-full flex items-center justify-center bg-gradient-to-br ${index % 3 === 0 ? 'from-sky-100 to-blue-50 text-sky-400' :
                  index % 3 === 1 ? 'from-orange-100 to-amber-50 text-orange-400' :
                    'from-violet-100 to-purple-50 text-violet-400'
                  }`}>
                  <BookOpen className="w-16 h-16 opacity-50" />
                </div>
              )}
              {/* 标签区域 */}
              <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                {course.grade && (
                  <span className="rounded-lg bg-white/95 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-indigo-600 shadow-sm border border-indigo-50">
                    {course.grade}
                  </span>
                )}
                {course.semester && (
                  <span className="rounded-lg bg-orange-500/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white shadow-sm border border-orange-400/50">
                    {course.semester}
                  </span>
                )}
              </div>
              <div className="absolute top-3 right-3 rounded-lg bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white shadow-sm border border-white/10">
                {course.lessonCount} 节课
              </div>
            </div>

            {/* Content Area */}
            <div className="flex flex-1 flex-col p-4">
              <h3 className="text-lg font-bold text-slate-800 mb-1 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                {course.title}
              </h3>

              <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-3 flex-1 leading-relaxed">
                {course.description || "暂无简介，快去探索吧！"}
              </p>

              <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {course.unitCount ? `${course.unitCount} 个单元` : course.topic || "General"}
                </span>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-orange-500 hover:shadow-lg hover:shadow-orange-500/30 hover:gap-3 disabled:opacity-50 disabled:hover:bg-slate-900 disabled:hover:shadow-none"
                  onClick={() => handleEnterCourse(course)}
                  disabled={course.lessonCount === 0}
                >
                  <span>开始学习</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {!isLoading && !filteredCourses.length && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center rounded-[2rem] bg-white border border-slate-100 border-dashed">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
              <BookOpen className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">
              {hasFilters ? "没有匹配的课程" : "暂无课程"}
            </h3>
            <p className="text-slate-500">
              {hasFilters ? "试试调整筛选条件" : "管理员还没有发布任何课程哦。"}
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
