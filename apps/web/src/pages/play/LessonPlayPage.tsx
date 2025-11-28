import { useEffect, useMemo, useRef, useState } from "react";
import type { SVGProps } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import classNames from "classnames";
import { fetchCourseContent, type CourseStage } from "../../api/courses";
import { TilesLessonExperience } from "../../components/play/TilesLessonExperience";
import { TypingLessonExperience } from "../../components/play/TypingLessonExperience";
import { SpaceBattleExperience } from "../../components/play/SpaceBattleExperience";
import { StagesProgressSidebar } from "../../components/StagesProgressSidebar";
import { progressStore } from "../../store/progressStore";
import { ArrowLeft, Star, Keyboard, MousePointer2 } from "lucide-react";

const MODES = ["tiles", "type", "game"] as const;

type LessonMode = (typeof MODES)[number];

const isValidMode = (value: string | undefined): value is LessonMode => MODES.includes(value as LessonMode);

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
  const nextStage = stageIndex >= 0 ? stages[stageIndex + 1] : undefined;
  const activeMode: LessonMode = isValidMode(mode) ? (mode as LessonMode) : "tiles";

  const [combo, setCombo] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationState | null>(null);
  const [stageMistakes, setStageMistakes] = useState(0);

  const celebrationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (celebrationTimeoutRef.current) {
      window.clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = null;
    }
    setCelebration(null);
    setCompleted(false);
    setStageMistakes(0);
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

  useEffect(() => () => {
    if (celebrationTimeoutRef.current) {
      window.clearTimeout(celebrationTimeoutRef.current);
    }
  }, []);

  if (!courseId || !stageId) {
    return <div className="flex min-h-screen items-center justify-center bg-[#FFFBF5] text-slate-500">缺少课程或关卡信息。</div>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFBF5] text-slate-500 font-bold">
        正在载入关卡...
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

  const progressRatio = stages.length ? Math.min(stageIndex + (completed ? 1 : 0), stages.length) / stages.length : 0;
  const progressPercent = Math.round(progressRatio * 100);

  const showSidebar = activeMode !== "game";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FFFBF5] text-slate-800 font-sans">
      {/* Playful Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-orange-100/60 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-sky-100/60 rounded-full blur-3xl animate-pulse delay-1000" />

      {/* Top Navigation */}
      <header className="relative z-20 mx-auto flex w-full items-center justify-between px-6 py-5 sm:px-8 bg-[#FFFBF5]/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
            onClick={handleBack}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回课程</span>
          </button>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center hidden sm:block">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold">Current Stage</p>
          <p className="text-sm font-black text-slate-800">{currentStage.lessonTitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-full bg-white px-3 py-1.5 border border-slate-100 shadow-sm">
            {activeMode === "tiles" ? <MousePointer2 className="w-3 h-3 text-sky-500" /> : <Keyboard className="w-3 h-3 text-violet-500" />}
            <span className="text-xs font-bold text-slate-600">
              {activeMode === "tiles" ? "点词" : activeMode === "type" ? "拼写" : "星际大战"}
            </span>
          </div>
          <div className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-bold text-white shadow-lg shadow-slate-200">
            {stageIndex + 1} <span className="text-slate-400">/</span> {stages.length}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto flex w-full flex-1 items-center justify-center px-4 pb-10 min-h-[calc(100vh-100px)]">
        {/* Content Container with Sidebar (for typing mode) */}
        <div
          className={classNames(
            "flex w-full max-w-6xl gap-8 overflow-hidden",
            showSidebar ? "flex-row" : "flex-col"
          )}
        >
          {/* Stages Progress Sidebar (Desktop) */}
          {showSidebar && (
            <div className="hidden lg:block w-72 shrink-0 h-[calc(100vh-140px)] sticky top-0">
              <StagesProgressSidebar
                stages={stages}
                currentIndex={stageIndex}
                className="rounded-3xl border border-white/60 shadow-sm overflow-hidden h-full"
              />
            </div>
          )}

          {/* Game Card */}
          <section
            className={classNames(
              "relative overflow-hidden rounded-3xl bg-white p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100",
              showSidebar ? "flex-1 min-w-0" : "w-full max-w-4xl"
            )}
          >

            {completed ? (
              <div className="relative z-10 flex h-full flex-col items-center justify-center text-center py-20">
                <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
                  <Trophy className="w-12 h-12 text-yellow-500" />
                </div>
                <h2 className="text-4xl font-black text-slate-800 mb-4">太棒了！全季通关</h2>
                <p className="max-w-md text-lg text-slate-500 font-medium mb-8">
                  你已经完成了本课程的所有关卡，休息一下，或者挑战新的课程吧！
                </p>
                <div className="flex gap-3 text-5xl mb-10">
                  {[...Array(3)].map((_, idx) => (
                    <Star key={idx} className="fill-yellow-400 text-yellow-400 animate-pulse drop-shadow-sm" style={{ animationDelay: `${idx * 0.15}s` }} />
                  ))}
                </div>
                <button
                  type="button"
                  className="rounded-2xl bg-slate-900 px-10 py-4 text-lg font-bold text-white shadow-xl hover:scale-105 transition-transform"
                  onClick={handleBack}
                >
                  返回课程中心
                </button>
              </div>
            ) : (
              <div className="relative z-10 flex h-full flex-col">
                {/* Progress & Stats Header */}
                <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Level {currentStage.difficulty ?? 1}
                      </span>
                      {combo > 1 && (
                        <span className="px-2 py-1 rounded-lg bg-orange-100 text-[10px] font-bold uppercase tracking-wider text-orange-600 animate-pulse">
                          Combo x{combo} 🔥
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-800 leading-tight">
                      {currentStage.lessonTitle}
                    </h2>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full sm:w-48">
                    <div className="flex justify-between text-xs font-bold text-slate-400 mb-1.5">
                      <span>进度</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-500 ease-out"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Game Area */}
                <div className="flex-1 flex items-center justify-center min-h-[400px] bg-slate-50/50 rounded-[2rem] border border-slate-100/50 p-4 sm:p-8">
                  {activeMode === "tiles" ? (
                    <TilesLessonExperience
                      stage={currentStage}
                      index={stageIndex}
                      total={stages.length}
                      onSuccess={handleSuccess}
                      onMistake={handleMistake}
                    />
                  ) : activeMode === "game" ? (
                    <SpaceBattleExperience
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
          <div className="relative flex flex-col items-center rounded-[2.5rem] bg-white px-12 py-10 text-center shadow-[0_20px_80px_rgba(0,0,0,0.2)] animate-in zoom-in-95 duration-300">
            <div className="mb-6 flex gap-3 text-6xl">
              {[...Array(celebration.stars)].map((_, idx) => (
                <Star key={idx} className="fill-yellow-400 text-yellow-400 animate-bounce drop-shadow-md" style={{ animationDelay: `${idx * 0.1}s` }} />
              ))}
            </div>
            <h3 className="text-3xl font-black text-slate-800 mb-2">{celebration.message}</h3>
            <p className="text-slate-500 font-bold text-lg">连击 x{celebration.combo}</p>
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
