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
      <h1 className="text-3xl font-bold text-slate-900">课程列表</h1>
      <p className="text-sm text-slate-600">后台发布的课程会显示在这里，点击进入查看关卡并开始闯关体验。</p>
      <div className="grid gap-4 md:grid-cols-2">
        {courses.map(course => (
          <div key={course.id} className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">{course.title}</h3>
                <p className="mt-1 text-sm text-slate-500">课程主题：{course.topic || "未填写"}</p>
                <p className="mt-1 text-sm text-slate-500">关卡数量：{course.lessonCount}</p>
              </div>
              {course.coverUrl && (
                <img
                  src={course.coverUrl}
                  alt={course.title}
                  className="h-16 w-16 rounded-xl object-cover shadow-sm"
                />
              )}
            </div>
            <p className="mt-3 text-xs text-slate-500 leading-relaxed">{course.description || "暂无简介。"}</p>
            <button
              type="button"
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
              onClick={() => handleEnterCourse(course)}
              disabled={course.lessonCount === 0}
            >
              进入课程
            </button>
          </div>
        ))}
        {!isLoading && !courses.length && (
          <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">暂无课程。</div>
        )}
        {isLoading && (
          <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">正在加载课程...</div>
        )}
      </div>
    </div>
  );
};
