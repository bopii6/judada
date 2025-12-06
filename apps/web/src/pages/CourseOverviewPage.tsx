import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCourseContent, type CourseStage } from "../api/courses";
import { AdventureMap } from "../components/AdventureMap";
import {
  Play,
  CheckCircle2,
  Ear,
  Sparkles
} from "lucide-react";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { useProgressStore } from "../store/progressStore";

export const CourseOverviewPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const progress = useProgressStore();

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

  const selectedStage = useMemo(
    () => stages.find(s => s.id === selectedStageId),
    [stages, selectedStageId]
  );

  const heroStats = useMemo(() => {
    const totalStages = data?.course?.stageCount ?? stages.length;
    const completedStages = stages.filter(stage => progress.stages[stage.id]).length;
    const completionPercent = totalStages ? Math.round((completedStages / totalStages) * 100) : 0;
    const unitCount =
      data?.course?.unitCount ??
      new Set(stages.map(stage => stage.unitNumber ?? stage.unitName ?? stage.lessonId)).size;
    return { totalStages, completedStages, completionPercent, unitCount };
  }, [data?.course?.stageCount, data?.course?.unitCount, stages, progress.stages]);

  const nextPlayableStage = useMemo(
    () => stages.find(stage => !progress.stages[stage.id]) ?? stages[0],
    [stages, progress.stages]
  );

  if (!courseId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500 dark:text-slate-400 font-bold">
        未找到课程。
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner text="正在加载课程内容..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-slate-500 dark:text-slate-400 font-bold">加载课程失败：{(error as Error).message}</p>
        <button
          type="button"
          className="rounded-2xl bg-slate-900 dark:bg-slate-700 px-6 py-3 text-sm font-bold text-white dark:text-slate-100 shadow-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-all"
          onClick={() => refetch()}
        >
          重试
        </button>
      </div>
    );
  }

  if (!data?.course) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500 dark:text-slate-400 font-bold">
        课程不存在或未发布。
      </div>
    );
  }

  const handleStartGame = (mode: "tiles" | "type" | "dictation") => {
    if (selectedStageId) {
      navigate(`/play/${courseId}/stages/${selectedStageId}/${mode}`);
    }
  };

  const handleHeroStart = () => {
    if (nextPlayableStage) {
      setSelectedStageId(nextPlayableStage.id);
    }
  };

  const scrollToAdventure = () => {
    const el = document.getElementById("course-adventure-map");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const { course } = data;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">

      <header className="relative overflow-hidden rounded-[1.25rem] bg-gradient-to-r from-orange-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 text-slate-900 dark:text-white p-5 sm:p-7 shadow-[0_20px_45px_rgba(15,23,42,0.12)] dark:shadow-none border border-orange-50/60 dark:border-slate-700/60">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-16 w-80 h-80 bg-orange-100 dark:bg-orange-900/30 blur-[160px] opacity-70" />
          <div className="absolute -bottom-20 right-10 w-72 h-72 bg-amber-100 dark:bg-amber-900/30 blur-[140px] opacity-50" />
        </div>
        {course.coverUrl && (
          <div className="absolute inset-y-0 right-0 hidden lg:block opacity-30">
            <img
              src={course.coverUrl}
              alt=""
              className="w-full h-full object-contain mix-blend-multiply"
            />
          </div>
        )}

        <div className="relative z-10 flex flex-col gap-8 lg:flex-row">
          <div className="flex-1 space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              {course.grade && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-900/30 px-3 py-1 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-800/50">
                  {course.grade}
                </span>
              )}
              {course.publisher && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 dark:bg-slate-800 px-3 py-1 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700">
                  {course.publisher}
                </span>
              )}
              {course.semester && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 dark:bg-slate-800 px-3 py-1 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700">
                  {course.semester}
                </span>
              )}
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl sm:text-4xl font-black leading-tight">
                {course.title || "课程闯关路线"}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                4 个单元 · 256 条核心句子 · 老师 24h 内语音点评。家长可查看学习日报，孩子完成关卡即可解锁奖章。
              </p>
              <div className="flex flex-wrap gap-10 text-slate-900">
                <div>
                  <p className="text-4xl font-black">{heroStats.unitCount}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">教材单元</p>
                </div>
                <div>
                  <p className="text-4xl font-black">{heroStats.totalStages}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">核心句子</p>
                </div>
                <div>
                  <p className="text-4xl font-black">{heroStats.completionPercent}%</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">当前进度</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleHeroStart}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-base font-black text-white shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                开始第 1 单元
              </button>
              <button
                type="button"
                onClick={scrollToAdventure}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 px-5 py-3 text-base font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                查看练习路线
              </button>
            </div>
          </div>

          <div className="w-full lg:max-w-sm flex justify-center">
            {course.coverUrl ? (
              <div className="relative rounded-[1.5rem] overflow-hidden shadow-2xl border border-white/60 w-64">
                <img
                  src={course.coverUrl}
                  alt={course.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-white text-sm">
                  官方教材封面
                </div>
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 w-64 h-80 flex items-center justify-center text-slate-400">
                无封面
              </div>
            )}
          </div>
        </div>
      </header>

      <section id="course-adventure-map">
        <AdventureMap
          stages={stages}
          onStart={(stageId) => setSelectedStageId(stageId)}
        />
      </section>

      {selectedStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedStageId(null)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 mb-4 text-2xl font-black">
                {selectedStage.stageSequence}
              </div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">
                {selectedStage.promptEn || selectedStage.answerEn || "暂无句子"}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium">{selectedStage.promptCn}</p>
            </div>

            <div className="grid gap-4">
              <button
                onClick={() => handleStartGame("tiles")}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-orange-100 dark:hover:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-orange-700 dark:group-hover:text-orange-400">点词模式</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium group-hover:text-orange-400 dark:group-hover:text-orange-500">轻松入门，点击单词完成句子</p>
                </div>
              </button>

              <button
                onClick={() => handleStartGame("type")}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-amber-100 dark:hover:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-400">拼写模式</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium group-hover:text-amber-400 dark:group-hover:text-amber-500">挑战自我，键盘输入完整单词</p>
                </div>
              </button>

              <button
                onClick={() => handleStartGame("dictation")}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-amber-100 dark:hover:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Ear className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-400">听写模式</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium group-hover:text-amber-400 dark:group-hover:text-amber-500">听英文句子，根据中文提示默写</p>
                </div>
                <div className="ml-auto">
                  <span className="px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">NEW</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
