import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPublishedCourses, type CourseSummary } from "../api/courses";
import { BookOpen, ArrowRight, Layers } from "lucide-react";

export const Courses = () => {
  const navigate = useNavigate();
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: fetchPublishedCourses
  });

  const handleEnterCourse = (course: CourseSummary) => {
    navigate(`/courses/${course.id}`);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3">

        <div className="inline-flex items-center gap-2 self-start rounded-full bg-orange-50 px-4 py-1.5 text-xs font-bold text-orange-500 border border-orange-100/50">
          <Layers className="w-3 h-3" />
          <span>LEARNING PATHS</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-800">探索课程</h1>
        <p className="text-slate-500 font-medium max-w-2xl">
          选择一个感兴趣的主题，开始你的英语进阶之旅。每个课程都包含精心设计的关卡。
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course, index) => (
          <div
            key={course.id}
            className="group flex flex-col rounded-[2rem] bg-white p-2 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-slate-100/50 hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300"
          >
            {/* Cover Image Area */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.5rem] bg-slate-100">
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
              <div className="absolute top-4 right-4 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">
                {course.lessonCount} 节课
              </div>
            </div>

            {/* Content Area */}
            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-xl font-bold text-slate-800 mb-2 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                {course.title}
              </h3>
              <p className="text-sm text-slate-500 font-medium line-clamp-2 mb-4 flex-1 leading-relaxed">
                {course.description || "暂无简介，快去探索吧！"}
              </p>

              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {course.topic || "General"}
                </span>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-orange-500 hover:shadow-lg hover:shadow-orange-500/30 hover:gap-3 disabled:opacity-50 disabled:hover:bg-slate-900 disabled:hover:shadow-none"
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

        {!isLoading && !courses.length && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center rounded-[2rem] bg-white border border-slate-100 border-dashed">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
              <BookOpen className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">暂无课程</h3>
            <p className="text-slate-500">管理员还没有发布任何课程哦。</p>
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
