import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PracticeBoard } from "../components/PracticeBoard";
import type { Question } from "../api/types";
import { fetchPublishedCourses, fetchCourseQuestions, type CourseSummary } from "../api/courses";

interface ActiveCourseState {
  sessionId: string;
  course: CourseSummary;
  questions: Question[];
}

export const Courses = () => {
  const [active, setActive] = useState<ActiveCourseState | null>(null);
  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: fetchPublishedCourses
  });

  const startPractice = async (course: CourseSummary) => {
    const { questions } = await fetchCourseQuestions(course.id);
    const normalized = questions.map(question => ({
      ...question,
      variants: Array.isArray(question.variants) ? question.variants : []
    }));

    setActive({
      sessionId: `preview-${course.id}`,
      course,
      questions: normalized
    });
  };

  if (active) {
    return (
      <div className="space-y-6">
        <button className="text-sm text-blue-600 hover:underline" onClick={() => setActive(null)}>
          返回课程列表
        </button>
        <h2 className="text-2xl font-semibold text-slate-900">{active.course.title}</h2>
        <PracticeBoard sessionId={active.sessionId} questions={active.questions} onFinished={() => setActive(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">课程列表</h1>
      <p className="text-sm text-slate-600">后台发布的课程会显示在这里，点击即可开始练习。</p>
      <div className="grid gap-4 md:grid-cols-2">
        {courses.map(course => (
          <div key={course.id} className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800">{course.title}</h3>
            <p className="mt-1 text-sm text-slate-500">课程主题：{course.topic || "未填写"}</p>
            <p className="mt-1 text-sm text-slate-500">关卡数量：{course.lessonCount}</p>
            <p className="mt-2 text-xs text-slate-500">{course.description || "暂无简介。"}</p>
            <button
              type="button"
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
              onClick={() => startPractice(course)}
              disabled={course.lessonCount === 0}
            >
              开始练习
            </button>
          </div>
        ))}
        {!courses.length && <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">暂无课程。</div>}
      </div>
    </div>
  );
};
