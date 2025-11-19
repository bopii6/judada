import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCourseContent, type CourseStage } from "../api/courses";
import { AdventureMap } from "../components/AdventureMap";
import { useProgressStore } from "../store/progressStore";
import { BookOpen, Clock, Star, Play, Lock, CheckCircle2 } from "lucide-react";

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
    return <div className="flex min-h-[50vh] items-center justify-center text-slate-500 font-bold">未找到课程。</div>;
  }

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-slate-500 font-bold">正在加载课程内容...</div>;
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-slate-500 font-bold">加载课程失败：{(error as Error).message}</p>
        <button
          type="button"
          className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-slate-800 transition-all"
          onClick={() => refetch()}
        >
          重试
        </button>
      </div>
    );
  }

  if (!data?.course) {
    return <div className="flex min-h-[50vh] items-center justify-center text-slate-500 font-bold">课程不存在或未发布。</div>;
  }

  const handleStart = (stageId: string, mode: "tiles" | "type") => {
    navigate(`/play/${courseId}/stages/${stageId}/${mode}`);
  };

  const { course } = data;

  return (
    <div className="space-y-10 max-w-5xl mx-auto pb-20">
      {/* Hero Header */}
      <header className="relative overflow-hidden rounded-[2.5rem] bg-white p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
        {/* Background Decorations */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-br from-orange-100/50 to-amber-100/50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-gradient-to-tr from-sky-100/50 to-indigo-100/50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
          {/* Cover Image */}
          <div className="shrink-0">
            {course.coverUrl ? (
              <img
                src={course.coverUrl}
                alt={course.title}
                className="h-40 w-40 sm:h-48 sm:w-48 rounded-[2rem] object-cover shadow-lg rotate-3 hover:rotate-0 transition-transform duration-500"
              />
            ) : (
              <div className="h-40 w-40 sm:h-48 sm:w-48 rounded-[2rem] bg-gradient-to-br from-violet-100 to-fuchsia-50 flex items-center justify-center text-violet-300 shadow-sm rotate-3 hover:rotate-0 transition-transform duration-500">
                <BookOpen className="w-16 h-16" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                <BookOpen className="w-3 h-3" />
                <span>{course.topic || "General Course"}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-800 leading-tight">{course.title}</h1>
            </div>

            <p className="text-slate-500 font-medium leading-relaxed max-w-2xl">
              {course.description || "这个课程包已经准备好啦，选择一个关卡开始闯关吧！"}
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-slate-50 px-4 py-2 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                {course.stageCount} 个关卡
              </div>
              {course.updatedAt && (
                <div className="flex items-center gap-2 text-sm font-bold text-slate-400 bg-slate-50 px-4 py-2 rounded-xl">
                  <Clock className="w-4 h-4" />
                  更新于 {new Date(course.updatedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Adventure Map Section */}
      <section>
        <AdventureMap
          courseId={courseId}
          stages={stages}
          onStart={(stageId, mode) => handleStart(stageId, mode ?? "tiles")}
        />
      </section>

      {/* Stage List Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-100 text-indigo-500">
            <Play className="w-5 h-5 fill-current" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">所有关卡</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {stages.map((stage, index) => {
            const stars = progress.stages[stage.id]?.bestStars ?? 0;
            const isLocked = index > 0 && !progress.stages[stages[index - 1].id];

            return (
              <div
                key={stage.id}
                className={`group relative overflow-hidden rounded-[2rem] border-2 transition-all duration-300 ${isLocked
                    ? "bg-slate-50 border-slate-100 opacity-80"
                    : "bg-white border-slate-100 hover:border-indigo-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1"
                  }`}
              >
                <div className="p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl font-black text-lg ${isLocked ? "bg-slate-200 text-slate-400" : "bg-indigo-50 text-indigo-500"
                        }`}>
                        {stage.stageSequence}
                      </div>
                      {stars > 0 && (
                        <div className="flex gap-0.5">
                          {[...Array(3)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${i < stars ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {isLocked ? (
                      <Lock className="w-5 h-5 text-slate-300" />
                    ) : stars > 0 ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    ) : null}
                  </div>

                  <h3 className={`text-xl font-bold mb-2 ${isLocked ? "text-slate-400" : "text-slate-800"}`}>
                    {stage.lessonTitle}
                  </h3>
                  <p className={`text-sm font-medium line-clamp-2 mb-6 ${isLocked ? "text-slate-400" : "text-slate-500"}`}>
                    {stage.promptCn}
                  </p>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={isLocked}
                      className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${isLocked
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-slate-900 text-white hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-200"
                        }`}
                      onClick={() => handleStart(stage.id, "tiles")}
                    >
                      点词模式
                    </button>
                    <button
                      type="button"
                      disabled={isLocked}
                      className={`flex-1 rounded-xl py-3 text-sm font-bold border-2 transition-all ${isLocked
                          ? "border-slate-200 text-slate-300 cursor-not-allowed"
                          : "border-slate-100 text-slate-600 hover:border-indigo-100 hover:text-indigo-600 hover:bg-indigo-50"
                        }`}
                      onClick={() => handleStart(stage.id, "type")}
                    >
                      拼写模式
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {!stages.length && (
            <div className="col-span-full py-12 text-center rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/50">
              <p className="text-slate-400 font-bold">这里空空如也，等待老师发布关卡...</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
