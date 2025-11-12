import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCourseContent, type CourseStage } from "../api/courses";
import { AdventureMap } from "../components/AdventureMap";
import { useProgressStore } from "../store/progressStore";

export const CourseOverviewPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ["course-content", courseId],
    queryFn: () => fetchCourseContent(courseId!),
    enabled: Boolean(courseId)
  });

  const stages = useMemo<CourseStage[]>(() => {
    if (!data?.stages) return [];
    return [...data.stages].sort((a, b) => a.stageSequence - b.stageSequence);
  }, [data]);
  const progress = useProgressStore();

  if (!courseId) {
    return <div>未找到课程。</div>;
  }

  if (isLoading) {
    return <div>正在加载课程内容...</div>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-500">加载课程失败：{(error as Error).message}</p>
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
          onClick={() => refetch()}
        >
          重试
        </button>
      </div>
    );
  }

  if (!data?.course) {
    return <div>课程不存在或未发布。</div>;
  }

  const handleStart = (stageId: string, mode: "tiles" | "type") => {
    navigate(`/play/${courseId}/stages/${stageId}/${mode}`);
  };

  const { course } = data;

  return (
    <div className="space-y-10">
      <header className="rounded-3xl bg-gradient-to-r from-indigo-500/10 via-primary/10 to-sky-400/10 p-8 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">课程主题</p>
            <h1 className="mt-2 text-4xl font-bold text-slate-900">{course.title}</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 leading-relaxed">
              {course.description || "这个课程包已经准备好啦，选择一个关卡开始闯关吧！"}
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="rounded-full bg-white/60 px-3 py-1 shadow-sm">共 {course.stageCount} 个关卡</span>
              <span className="rounded-full bg-white/60 px-3 py-1 shadow-sm">主题：{course.topic || "未填写"}</span>
              {course.updatedAt && (
                <span className="rounded-full bg-white/60 px-3 py-1 shadow-sm">
                  最近更新：{new Date(course.updatedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          {course.coverUrl && (
            <img
              src={course.coverUrl}
              alt={course.title}
              className="h-40 w-40 rounded-3xl object-cover shadow-lg"
            />
          )}
        </div>
      </header>

      <section className="space-y-6">
        <AdventureMap
          courseId={courseId}
          stages={stages}
          onStart={(stageId, mode) => handleStart(stageId, mode ?? "tiles")}
        />
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">选择关卡</h2>
          <p className="mt-1 text-sm text-slate-500">每个关卡都是一次独立的练习，难度会逐步提升。</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {stages.map(stage => {
            const stageTypeLabel =
              stage.type === "tiles"
                ? "点词"
                : stage.type === "speak"
                  ? "口语"
                  : stage.type === "listenTap"
                    ? "听力"
                    : "键入";
            const stars = progress.stages[stage.id]?.bestStars ?? 0;
            return (
            <div key={stage.id} className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-white/60 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">关卡 #{stage.stageSequence}</div>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">{stage.lessonTitle}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{stage.promptCn}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right text-xs text-slate-500">
                  <div>预估用时：{stage.estimatedSeconds ?? 20} 秒</div>
                  <div>类型：{stageTypeLabel}</div>
                  <div className="mt-1 text-base text-amber-500">
                    {[...Array(3)].map((_, idx) => (
                      <span key={idx}>{idx < stars ? "★" : "☆"}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3 text-sm font-medium">
                <button
                  type="button"
                  className="rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 px-5 py-2 text-white shadow transition hover:from-emerald-500 hover:to-emerald-600"
                  onClick={() => handleStart(stage.id, "tiles")}
                >
                  点词成句
                </button>
                <button
                  type="button"
                  className="rounded-full border border-primary/40 bg-white px-5 py-2 text-primary shadow-sm transition hover:bg-primary/5"
                  onClick={() => handleStart(stage.id, "type")}
                >
                  键入练习
                </button>
              </div>
            </div>
          );
          })}
          {!stages.length && <div className="rounded-3xl bg-white/80 p-6 text-sm text-slate-500">当前课程暂无已发布的关卡。</div>}
        </div>
      </section>
    </div>
  );
};
