import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCourseContent, type CourseStage } from "../api/courses";
import { AdventureMap } from "../components/AdventureMap";
import { BookOpen, Clock, Play, CheckCircle2, Ear } from "lucide-react";

export const CourseOverviewPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

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

  const selectedStage = useMemo(() =>
    stages.find(s => s.id === selectedStageId),
    [stages, selectedStageId]);

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

  const handleStartGame = (mode: "tiles" | "type" | "dictation") => {
    if (selectedStageId) {
      navigate(`/play/${courseId}/stages/${selectedStageId}/${mode}`);
    }
  };

  const { course } = data;

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-20">

      {/* Hero Header */}
      <header className="relative overflow-hidden rounded-[2rem] bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
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
                loading="lazy"
                className="h-32 w-32 sm:h-40 sm:w-40 rounded-2xl object-cover shadow-lg rotate-3 hover:rotate-0 transition-transform duration-500"
              />
            ) : (
              <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-50 flex items-center justify-center text-violet-300 shadow-sm rotate-3 hover:rotate-0 transition-transform duration-500">
                <BookOpen className="w-16 h-16" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div>
              {/* 标签区域 */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {course.grade && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600 border border-indigo-100">
                    {course.grade}
                  </span>
                )}
                {course.publisher && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 border border-slate-200">
                    {course.publisher}
                  </span>
                )}
                {course.semester && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-600 border border-orange-100">
                    {course.semester}
                  </span>
                )}
                {!course.grade && !course.publisher && (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider border border-slate-200">
                    <BookOpen className="w-3 h-3" />
                    <span>{course.topic || "General Course"}</span>
                  </div>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 leading-tight">{course.title}</h1>
            </div>

            <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-2xl">
              {course.description || "这个课程包已经准备好啦，选择一个关卡开始闯关吧！"}
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              {course.unitCount && course.unitCount > 1 && (
                <div className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-slate-50 px-4 py-2 rounded-xl">
                  <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                  {course.unitCount} 个单元
                </div>
              )}
              <div className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-slate-50 px-4 py-2 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                {course.stageCount} 个关卡
              </div>
              {course.updatedAt && (
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg">
                  <Clock className="w-3.5 h-3.5" />
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
          stages={stages}
          onStart={(stageId) => setSelectedStageId(stageId)}
        />
      </section>

      {/* Mode Selection Modal */}
      {selectedStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedStageId(null)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 mb-4 text-2xl font-black">
                {selectedStage.stageSequence}
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">
                {selectedStage.promptEn || selectedStage.answerEn || "暂无句子"}
              </h3>
              <p className="text-slate-500 font-medium">{selectedStage.promptCn}</p>
            </div>

            <div className="grid gap-4">
              <button
                onClick={() => handleStartGame("tiles")}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-100 hover:bg-indigo-50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 group-hover:text-indigo-700">点词模式</h4>
                  <p className="text-xs text-slate-400 font-medium group-hover:text-indigo-400">轻松入门，点击单词完成句子</p>
                </div>
              </button>

              <button
                onClick={() => handleStartGame("type")}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-violet-100 hover:bg-violet-50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-violet-100 text-violet-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 group-hover:text-violet-700">拼写模式</h4>
                  <p className="text-xs text-slate-400 font-medium group-hover:text-violet-400">挑战自我，键盘输入完整单词</p>
                </div>
              </button>

              <button
                onClick={() => handleStartGame("dictation")}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-amber-100 hover:bg-amber-50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Ear className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 group-hover:text-amber-700">听写模式</h4>
                  <p className="text-xs text-slate-400 font-medium group-hover:text-amber-400">听英文句子，根据中文提示默写</p>
                </div>
                <div className="ml-auto">
                  <span className="px-2 py-1 rounded-lg bg-amber-100 text-[10px] font-bold text-amber-600 uppercase">NEW</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
