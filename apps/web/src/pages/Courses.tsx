import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPublishedCourses, type CourseSummary } from "../api/courses";

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
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Learning Paths</p>
        <h1 className="text-3xl font-bold text-slate-900">课程列表</h1>
        <p className="text-sm text-slate-600">后台发布的课程会展示在这里，挑一个开始你的专属进阶。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {courses.map(course => (
          <div
            key={course.id}
            className="group rounded-2xl border border-slate-200/70 bg-white/85 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="pr-4">
                <h3 className="text-lg font-semibold text-slate-900">{course.title}</h3>
                <p className="mt-1 text-sm text-slate-500">课程主题：{course.topic || "未填写"}</p>
                <p className="mt-1 text-sm text-slate-500">课次数量：{course.lessonCount}</p>
              </div>
              {course.coverUrl && (
                <img
                  src={course.coverUrl}
                  alt={course.title}
                  className="h-16 w-16 rounded-xl object-cover shadow-sm"
                />
              )}
            </div>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">{course.description || "暂无简介。"}</p>
            <button
              type="button"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:from-indigo-600 hover:to-blue-700 disabled:opacity-50"
              onClick={() => handleEnterCourse(course)}
              disabled={course.lessonCount === 0}
            >
              进入课程
            </button>
          </div>
        ))}

        {!isLoading && !courses.length && (
          <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-6 text-sm text-slate-500">
            暂无课程。
          </div>
        )}
        {isLoading && (
          <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-6 text-sm text-slate-500">
            正在加载课程...
          </div>
        )}
      </div>
    </div>
  );
};
