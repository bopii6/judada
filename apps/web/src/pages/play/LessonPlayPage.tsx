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
import { ArrowLeft, Star, Keyboard, MousePointer2, Share2, Volume2, LifeBuoy } from "lucide-react";
import { formatStageOriginLabel } from "../../utils/stageOrigin";

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
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans selection:bg-orange-100 dark:selection:bg-orange-900 selection:text-orange-700 dark:selection:text-orange-300 transition-colors">
      {/* Elegant Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-orange-200/20 dark:bg-orange-900/20 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-normal animate-blob" />
        <div className="absolute top-[-10%] right-[-20%] w-[600px] h-[600px] bg-amber-200/20 dark:bg-amber-900/20 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-normal animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[600px] h-[600px] bg-orange-200/20 dark:bg-orange-900/20 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-normal animate-blob animation-delay-4000" />
      </div>

      {/* Top Navigation */}
      <header className="relative z-20 mx-auto flex w-full items-center justify-between px-6 py-4 sm:px-8 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-b border-white/50 dark:border-slate-700/50 sticky top-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="group inline-flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            onClick={handleBack}
          >
            <div className="p-2 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 group-hover:border-slate-300 dark:group-hover:border-slate-500 group-hover:shadow-sm transition-all">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span>返回课程</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-slate-700/80 px-4 py-2 border border-slate-200/60 dark:border-slate-600/60 shadow-sm backdrop-blur-sm">
              {activeMode === "tiles" ? (
                <MousePointer2 className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
              ) : activeMode === "dictation" ? (
                <Volume2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              ) : (
                <Keyboard className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
              )}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {activeMode === "tiles" ? "点词" : activeMode === "type" ? "拼写" : "听写"}
              </span>
            </div>
            {isDictationMode && (
              <button
                type="button"
                onClick={handleDictationHelp}
                disabled={dictationHelpLevel >= 2}
                className={classNames(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all border",
                  dictationHelpLevel >= 2
                    ? "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-600 cursor-not-allowed"
                    : "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800 shadow-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-300"
                )}
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                {dictationHelpLevel === 0 ? "听不出来？求助" : dictationHelpLevel === 1 ? "再给提示" : "提示已全部展示"}
              </button>
            )}
          </div>
          <div className="rounded-full bg-slate-900 dark:bg-slate-700 px-5 py-2 text-sm font-bold text-white dark:text-slate-100 shadow-lg shadow-slate-900/20 dark:shadow-slate-900/40 ring-2 ring-white dark:ring-slate-600">
            {Math.max(1, currentUnitStageIndex + 1)} <span className="text-slate-500 dark:text-slate-400 mx-1">/</span> {currentUnitStages.length || stages.length}
          </div>
        </div>
      </header>
      {isDictationMode && null}
      {/* Main Content */}
      <main className="relative z-10 mx-auto flex w-full flex-1 items-center justify-center px-4 py-6 sm:py-10 min-h-[calc(100vh-80px)]">
        {/* Content Container with Sidebar (for typing mode) */}
        <div
          className={classNames(
            "flex w-full max-w-7xl gap-6 lg:gap-10",
            showSidebar ? "flex-row" : "flex-col"
          )}
        >
          {/* Stages Progress Sidebar (Desktop) */}
          {showSidebar && (
            <div className="hidden lg:block w-72 shrink-0 h-[calc(100vh-160px)] sticky top-24">
              <StagesProgressSidebar
                stages={stages}
                currentIndex={stageIndex}
                className="rounded-[2rem] border border-white/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md shadow-sm overflow-hidden h-full"
              />
            </div>
          )}

          {/* Game Area - No Card Container */}
          <section
            className={classNames(
              "relative",
              showSidebar ? "flex-1 min-w-0" : "w-full max-w-4xl mx-auto"
            )}
          >

            {completed ? (
              <div className="relative z-10 flex h-full flex-col items-center justify-center text-center py-24 px-6">
                <div className="w-32 h-32 bg-gradient-to-br from-yellow-100 to-amber-100 rounded-full flex items-center justify-center mb-8 animate-bounce shadow-inner">
                  <Trophy className="w-16 h-16 text-amber-500" />
                </div>
                <h2 className="text-4xl sm:text-5xl font-black text-slate-800 dark:text-slate-100 mb-6 tracking-tight">太棒了！全季通关</h2>
                <p className="max-w-md text-lg text-slate-500 dark:text-slate-400 font-medium mb-12 leading-relaxed">
                  你已经完成了本课程的所有关卡，休息一下，或者挑战新的课程吧！
                </p>
                <div className="flex gap-4 text-6xl mb-12">
                  {[...Array(3)].map((_, idx) => (
                    <Star key={idx} className="fill-yellow-400 text-yellow-400 animate-pulse drop-shadow-sm" style={{ animationDelay: `${idx * 0.15}s` }} />
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                  <button
                    type="button"
                    className="flex-1 rounded-2xl bg-slate-900 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-slate-900/20 hover:scale-[1.02] hover:bg-slate-800 transition-all active:scale-[0.98]"
                    onClick={handleBack}
                  >
                    返回课程中心
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-8 py-4 text-lg font-bold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    onClick={handleShare}
                  >
                    <Share2 className="w-5 h-5" />
                    炫耀一下
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative z-10 flex h-full flex-col">
                {!isDictationMode && (
                  <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
                      {combo > 1 && (
                        <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-orange-500/30 animate-pulse">
                          Combo x{combo} 🔥
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full sm:w-56">
                      <div className="flex justify-between text-xs font-bold text-slate-400 dark:text-slate-500 mb-2">
                        <span>进度</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/60 dark:bg-slate-700/60 backdrop-blur-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_0_10px_rgba(251,146,60,0.5)] transition-all duration-500 ease-out"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Game Area */}
                <div className="flex-1 flex items-center justify-center min-h-[400px]">
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
          </section>
        </div>
      </main>

      {/* Celebration Overlay */}
      {celebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="relative flex flex-col items-center w-full max-w-sm rounded-[2.5rem] bg-white dark:bg-slate-800 px-8 py-12 text-center shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="mb-8 flex gap-2 text-6xl">
              {[...Array(celebration.stars)].map((_, idx) => (
                <Star key={idx} className="fill-yellow-400 text-yellow-400 animate-bounce drop-shadow-lg" style={{ animationDelay: `${idx * 0.1}s` }} />
              ))}
            </div>
            <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-3 tracking-tight">{celebration.message}</h3>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-lg bg-slate-100 dark:bg-slate-700 px-4 py-1 rounded-full">连击 x{celebration.combo}</p>
          </div>
        </div>
      )}
    </div>
  );
};

type TrophyProps = SVGProps<SVGSVGElement>;

function Trophy(props: TrophyProps) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}

