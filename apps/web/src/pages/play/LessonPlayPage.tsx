import { useEffect, useMemo, useRef, useState } from "react";
import type { SVGProps } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import classNames from "classnames";
import { fetchCourseContent, type CourseStage } from "../../api/courses";
import { TilesLessonExperience } from "../../components/play/TilesLessonExperience";
import { TypingLessonExperience } from "../../components/play/TypingLessonExperience";
import { StagesProgressSidebar } from "../../components/StagesProgressSidebar";
import { progressStore } from "../../store/progressStore";
import { ArrowLeft, Star, Keyboard, MousePointer2, Share2, Volume2, LifeBuoy, Trophy, Sparkles, X, Flag, Flame, Target } from "lucide-react";
import { formatStageOriginLabel } from "../../utils/stageOrigin";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";

const MODES = ["tiles", "type", "dictation"] as const;

type LessonMode = (typeof MODES)[number];

const isValidMode = (value: string | undefined): value is LessonMode => MODES.includes(value as LessonMode);

const getUnitKey = (stage?: CourseStage) => {
  if (!stage) return "unit-none";
  if (typeof stage.unitNumber === "number") {
    return `num-${stage.unitNumber}`;
  }
  if (stage.unitName?.trim()) {
    return `name-${stage.unitName.trim()}`;
  }
  return "unit-none";
};

interface CelebrationState {
  stars: number;
  combo: number;
  message: string;
}

const calculateStars = (mistakes: number) => {
  if (mistakes === 0) return 3;
  if (mistakes === 1) return 2;
  return 1;
};

export const LessonPlayPage = () => {
  const { courseId, stageId, mode } = useParams<{ courseId: string; stageId: string; mode: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["course-content", courseId],
    queryFn: () => fetchCourseContent(courseId!),
    enabled: Boolean(courseId)
  });

  const stages = useMemo<CourseStage[]>(() => data?.stages ?? [], [data]);
  const stageIndex = useMemo(() => stages.findIndex(stage => stage.id === stageId), [stages, stageId]);
  const currentStage = stageIndex >= 0 ? stages[stageIndex] : undefined;
  const currentUnitStages = useMemo(() => {
    if (!currentStage) return [];
    const key = getUnitKey(currentStage);
    return stages.filter(stage => getUnitKey(stage) === key);
  }, [stages, currentStage]);
  const currentUnitStageIndex = useMemo(() => {
    if (!currentStage) return stageIndex;
    const idx = currentUnitStages.findIndex(stage => stage.id === currentStage.id);
    return idx >= 0 ? idx : stageIndex;
  }, [currentStage, currentUnitStages, stageIndex]);
  const nextStage = stageIndex >= 0 ? stages[stageIndex + 1] : undefined;
  const stageOriginLabel = currentStage ? formatStageOriginLabel(currentStage) : null;
  const activeMode: LessonMode = isValidMode(mode) ? (mode as LessonMode) : "tiles";
  const isDictationMode = activeMode === "dictation";

  const [combo, setCombo] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationState | null>(null);
  const [stageMistakes, setStageMistakes] = useState(0);

  const celebrationTimeoutRef = useRef<number | null>(null);
  const [dictationHelpLevel, setDictationHelpLevel] = useState<0 | 1 | 2>(0);
  const sessionStartRef = useRef<number>(Date.now());

  useEffect(() => {
    if (celebrationTimeoutRef.current) {
      window.clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = null;
    }
    setCelebration(null);
    setCompleted(false);
    setStageMistakes(0);
    sessionStartRef.current = Date.now();
  }, [stageId]);

  const handleBack = () => {
    if (!courseId) {
      navigate("/courses");
      return;
    }
    navigate(`/courses/${courseId}`);
  };

  const handleSuccess = () => {
    if (courseId && stageId) {
      const starsEarned = calculateStars(stageMistakes);
      progressStore.recordStageCompletion({
        courseId,
        stageId,
        stars: starsEarned,
        mode: activeMode
      });
      setStageMistakes(0);
      setCelebration({
        stars: starsEarned,
        combo: combo + 1,
        message: starsEarned === 3 ? "完美连击！" : starsEarned === 2 ? "越来越棒！" : "继续加油！"
      });
    }
    setCombo(prevCombo => prevCombo + 1);

    celebrationTimeoutRef.current = window.setTimeout(() => {
      setCelebration(null);
      if (nextStage) {
        navigate(`/play/${courseId}/stages/${nextStage.id}/${activeMode}`, { replace: true });
      } else {
        setCompleted(true);
      }
    }, 1200);
  };

  const handleMistake = () => {
    setCombo(0);
    setStageMistakes(prev => prev + 1);
  };

  const handleShare = () => {
    if (!courseId) return;
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - sessionStartRef.current) / 1000));
    navigate(`/share/${courseId}`, {
      state: {
        courseTitle: data?.course?.title ?? stageOriginLabel ?? "教材闯关",
        stageCount: stages.length,
        elapsedSeconds,
        stars: celebration?.stars ?? calculateStars(stageMistakes),
        comboStreak: combo
      }
    });
  };

  useEffect(() => () => {
    if (celebrationTimeoutRef.current) {
      window.clearTimeout(celebrationTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    setDictationHelpLevel(0);
  }, [stageId, isDictationMode]);

  if (!courseId || !stageId) {
    return <div className="flex min-h-screen items-center justify-center bg-[#FFFBF5] text-slate-500">缺少课程或关卡信息。</div>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFBF5]">
        <LoadingSpinner text="正在加载课程内容..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FFFBF5] text-slate-600">
        <p>加载课程内容失败：{(error as Error).message}</p>
        <button
          type="button"
          className="rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white"
          onClick={() => refetch()}
        >
          重试
        </button>
        <button
          type="button"
          className="text-sm text-slate-500 underline"
          onClick={handleBack}
        >
          返回课程列表
        </button>
      </div>
    );
  }

  if (!currentStage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FFFBF5] text-slate-600">
        <p>未找到该关卡，可能尚未发布或已被移动。</p>
        <button
          type="button"
          className="rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white"
          onClick={handleBack}
        >
          返回课程列表
        </button>
      </div>
    );
  }

  const progressRatio = currentUnitStages.length
    ? Math.min(currentUnitStageIndex + (completed ? 1 : 0), currentUnitStages.length) / currentUnitStages.length
    : 0;
  const progressPercent = Math.round(progressRatio * 100);
  const showSidebar = true;

  const handleDictationHelp = () => {
    if (!isDictationMode) return;
    setDictationHelpLevel(prev => {
      const next = prev >= 2 ? 2 : ((prev + 1) as 0 | 1 | 2);
      return next;
    });
  };

  return (
    <div className="relative min-h-screen w-full bg-[#f8f9fc] dark:bg-slate-950 font-sans selection:bg-orange-100 dark:selection:bg-orange-900 selection:text-orange-700 dark:selection:text-orange-300">

      {/* Premium Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[1000px] h-[1000px] bg-gradient-to-br from-indigo-100/40 to-purple-100/40 dark:from-indigo-900/10 dark:to-purple-900/10 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-normal opacity-70" />
        <div className="absolute top-[20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-bl from-orange-100/40 to-amber-100/40 dark:from-orange-900/10 dark:to-amber-900/10 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-normal opacity-70" />
      </div>

      {/* Main Layout Grid */}
      <div className="relative z-10 flex h-screen overflow-hidden">

        {/* Left Sidebar (Map) - Preserved & Refined */}
        {showSidebar && (
          <aside className="hidden lg:flex flex-col w-[320px] xl:w-[360px] h-full border-r border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl relative z-20 shadow-[4px_0_30px_rgba(0,0,0,0.02)]">
            <StagesProgressSidebar
              stages={stages}
              currentIndex={stageIndex}
              className="h-full w-full bg-transparent border-none shadow-none"
            />
          </aside>
        )}

        {/* Right Content Area (Game) */}
        <main className="flex-1 flex flex-col h-full relative min-w-0">

          {/* Header */}
          <header className="h-20 shrink-0 px-6 sm:px-10 flex items-center justify-between z-30 relative">
            {/* Left: Back (Mobile Only or Breadcrumb) */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleBack}
                className="group flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                title="返回课程主页"
              >
                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm group-hover:scale-105 group-hover:border-slate-300 dark:group-hover:border-slate-600 transition-all">
                  <ArrowLeft className="w-5 h-5" />
                </div>
                <span className="hidden sm:inline font-bold text-sm">退出挑战</span>
              </button>
            </div>

            {/* Center: Simplified - just origin label on larger screens */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex items-center gap-2 text-xs font-medium text-slate-400 dark:text-slate-500">
              <span className="w-1 h-1 rounded-full bg-orange-400" />
              {stageOriginLabel ?? "PRACTICE"}
            </div>

            {/* Right: Mode & Stats */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Mode Badge - Simplified icon only */}
              <div className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60" title={activeMode === "tiles" ? "点词模式" : activeMode === "type" ? "拼写模式" : "听写模式"}>
                {activeMode === "tiles" ? (
                  <MousePointer2 className="w-4 h-4 text-orange-500" />
                ) : activeMode === "dictation" ? (
                  <Volume2 className="w-4 h-4 text-sky-500" />
                ) : (
                  <Keyboard className="w-4 h-4 text-purple-500" />
                )}
              </div>

              {/* Progress Count */}
              <div className="flex items-center gap-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-full shadow-lg shadow-slate-900/10 dark:shadow-none">
                <Flag className="w-3.5 h-3.5 fill-current" />
                <span className="text-sm font-bold tracking-tight">
                  {currentUnitStageIndex + 1} <span className="opacity-40 mx-0.5">/</span> {currentUnitStages.length}
                </span>
              </div>
            </div>
          </header>

          {/* Content Container - No Scroll */}
          <div className="flex-1 overflow-hidden p-4 sm:p-6 flex flex-col items-center relative">

            {/* Combo Indicator - Absolute Position, Never Affects Layout */}
            {!completed && combo > 1 && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
                <div className="animate-in fade-in duration-200 flex items-center gap-1.5 px-3 py-1 bg-orange-500 text-white rounded-full text-xs font-bold shadow-lg">
                  <Flame className="w-3 h-3 fill-white" />
                  <span>x{combo}</span>
                </div>
              </div>
            )}

            <div className="w-full max-w-4xl mx-auto flex flex-col flex-1 min-h-0">

              {/* Main Game Area */}
              <div className="relative flex-1 flex flex-col">
                <div className={classNames(
                  "relative flex-1 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden flex flex-col",
                  completed ? "items-center justify-center p-8 sm:p-12 text-center" : ""
                )}>

                  {completed ? (
                    /* Success View */
                    <div className="max-w-md w-full animate-in zoom-in-95 duration-500">
                      <div className="mx-auto w-32 h-32 bg-gradient-to-tr from-yellow-300 to-amber-500 rounded-full flex items-center justify-center shadow-[0_15px_40px_-5px_rgba(245,158,11,0.5)] mb-8 relative">
                        <Trophy className="w-16 h-16 text-white drop-shadow-md" />
                        <div className="absolute inset-0 rounded-full ring-4 ring-white/30 animate-ping opacity-20" />
                        <Sparkles className="absolute -top-2 -right-2 text-yellow-400 w-10 h-10 animate-bounce" />
                      </div>

                      <h2 className="text-4xl font-black text-slate-800 dark:text-white mb-4 tracking-tight">
                        关卡完成！
                      </h2>
                      <p className="text-slate-500 dark:text-slate-400 font-medium text-lg mb-10 leading-relaxed">
                        太棒了！你已经掌握了本关卡的所有内容。
                      </p>

                      <div className="grid grid-cols-3 gap-4 mb-10">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex flex-col items-center gap-2 animate-in slide-in-from-bottom-4 fade-in duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                            <Star className="w-10 h-10 fill-amber-400 text-amber-500 drop-shadow-md" />
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4">
                        <button
                          onClick={handleBack}
                          className="flex-1 px-8 py-4 rounded-2xl font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                          返回列表
                        </button>
                        <button
                          onClick={handleShare}
                          className="flex-1 px-8 py-4 rounded-2xl font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl shadow-slate-900/20 hover:scale-[1.02] hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                        >
                          <Share2 className="w-5 h-5" />
                          炫耀一下
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Interactive Game Area - Clean */
                    <div className="flex-1 overflow-hidden relative">
                      {/* Help Button (Dictation) Floater - moved inside card */}
                      {isDictationMode && (
                        <div className="absolute top-4 right-4 z-20">
                          <button
                            type="button"
                            onClick={handleDictationHelp}
                            disabled={dictationHelpLevel >= 2}
                            className={classNames(
                              "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-sm backdrop-blur-md transition-all",
                              dictationHelpLevel >= 2
                                ? "bg-slate-100/80 text-slate-400 cursor-not-allowed"
                                : "bg-white/90 text-amber-600 hover:bg-amber-50 ring-1 ring-amber-100/50"
                            )}
                          >
                            <LifeBuoy className="w-3.5 h-3.5" />
                            {dictationHelpLevel === 0 ? "求助" : dictationHelpLevel === 1 ? "再给点提示" : "无更多提示"}
                          </button>
                        </div>
                      )}

                      <div className="h-full flex items-center justify-center p-4">
                        {activeMode === "tiles" ? (
                          <TilesLessonExperience
                            stage={currentStage}
                            index={stageIndex}
                            total={stages.length}
                            onSuccess={handleSuccess}
                            onMistake={handleMistake}
                          />
                        ) : (
                          <TypingLessonExperience
                            stage={currentStage}
                            index={stageIndex}
                            total={stages.length}
                            onSuccess={handleSuccess}
                            onMistake={handleMistake}
                            variant={isDictationMode ? "dictation" : "typing"}
                            helpLevel={isDictationMode ? dictationHelpLevel : 0}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Celebration Overlay */}
      {celebration && (
        <div className="fixed top-[20%] left-1/2 -translate-x-1/2 pointer-events-none z-50 flex flex-col items-center animate-out fade-out slide-out-to-top-10 duration-1000 fill-mode-forwards">
          <div className="text-6xl font-black text-amber-500 drop-shadow-[0_4px_0_#FFF] dark:drop-shadow-[0_4px_0_#000] tracking-tighter animate-bounce">
            {celebration.message}
          </div>
          {celebration.combo > 1 && (
            <div className="mt-2 px-4 py-1 bg-slate-900 text-white text-sm font-bold rounded-full shadow-xl">
              COMBO x{celebration.combo}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

// Helper for 'isMaster' check if needed, though mostly visual
const isMaster = false; // logic placeholder if we want to show master UI during play

