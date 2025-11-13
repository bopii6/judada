import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCourseContent, type CourseStage } from "../../api/courses";
import { TilesLessonExperience } from "../../components/play/TilesLessonExperience";
import { TypingLessonExperience } from "../../components/play/TypingLessonExperience";
import { progressStore } from "../../store/progressStore";

const MODES = ["tiles", "type"] as const;

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
  const [bestCombo, setBestCombo] = useState(0);
  const [attempts, setAttempts] = useState(0);
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
    setAttempts(prev => prev + 1);
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
    setCombo(prevCombo => {
      const nextCombo = prevCombo + 1;
      setBestCombo(prevBest => (nextCombo > prevBest ? nextCombo : prevBest));
      return nextCombo;
    });

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
    setAttempts(prev => prev + 1);
    setCombo(0);
    setStageMistakes(prev => prev + 1);
  };

  useEffect(() => () => {
    if (celebrationTimeoutRef.current) {
      window.clearTimeout(celebrationTimeoutRef.current);
    }
  }, []);

  if (!courseId || !stageId) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">缺少课程或关卡信息。</div>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-500 via-indigo-600 to-purple-600 text-white">
        正在载入关卡...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-white">
        <p>加载课程内容失败：{(error as Error).message}</p>
        <button
          type="button"
          className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white"
          onClick={() => refetch()}
        >
          重试
        </button>
        <button
          type="button"
          className="text-sm text-white/70 underline"
          onClick={handleBack}
        >
          返回课程列表
        </button>
      </div>
    );
  }

  if (!currentStage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-white">
        <p>未找到该关卡，可能尚未发布或已被移动。</p>
        <button
          type="button"
          className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white"
          onClick={handleBack}
        >
          返回课程列表
        </button>
      </div>
    );
  }

  const progressRatio = stages.length ? Math.min(stageIndex + (completed ? 1 : 0), stages.length) / stages.length : 0;
  const progressPercent = Math.round(progressRatio * 100);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* 氛围背景 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-transparent blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[26rem] w-[26rem] translate-x-1/3 translate-y-1/3 rounded-full bg-gradient-to-tl from-pink-500/30 via-orange-400/20 to-transparent blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0.4),_transparent_70%)]" />
      </div>

      {/* 顶部导航 */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <button
          type="button"
          className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold tracking-wide text-white transition hover:bg-white/10"
          onClick={handleBack}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-lg group-hover:bg-white/30">
            ←
          </span>
          返回课程
        </button>
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Current Stage</p>
          <p className="text-lg font-semibold text-white">{currentStage.lessonTitle}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
          {stageIndex + 1}/{stages.length} · {activeMode === "tiles" ? "探索模式" : "键入模式"}
        </div>
      </header>

      {/* 主要内容 */}
      <main className="relative z-10 mx-auto flex w-full flex-1 items-center justify-center px-4 pb-10">
        {/* 沉浸式游戏区域 */}
        <section className="relative w-full max-w-4xl overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/0 p-6 shadow-[0_30px_120px_rgba(15,23,42,0.8)] backdrop-blur-3xl">
          <div className="pointer-events-none absolute inset-y-6 right-10 w-64 rounded-full bg-gradient-to-t from-indigo-500/30 to-purple-500/10 blur-[80px]" />
          <div className="pointer-events-none absolute -left-10 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-rose-400/20 blur-[120px]" />

          {completed ? (
            <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm uppercase tracking-[0.4em] text-white/40">Season Clear</p>
              <h2 className="mt-4 text-4xl font-semibold text-white">你征服了本季所有关卡</h2>
              <p className="mt-4 max-w-md text-base text-white/70">
                星级表现已记录，继续探索新的课程包，或者巩固刚刚完成的内容。
              </p>
              <div className="mt-6 flex gap-2 text-4xl">
                {[...Array(3)].map((_, idx) => (
                  <span key={idx} className="animate-pulse" style={{ animationDelay: `${idx * 0.15}s` }}>
                    ⭐
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="mt-8 rounded-full bg-white px-8 py-3 text-base font-semibold text-indigo-700 transition hover:-translate-y-0.5"
                onClick={handleBack}
              >
                返回课程中心
              </button>
            </div>
          ) : (
            <div className="relative z-10 flex h-full flex-col">
              <div className="mb-4 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-[0.3em] text-white/50">
                    <span>Stage Brief</span>
                    <span>{stageIndex + 1}/{stages.length}</span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-white sm:text-3xl md:text-4xl">
                    {currentStage.lessonTitle}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                  <span className="rounded-full border border-white/20 px-3 py-1 backdrop-blur">
                    {activeMode === "tiles" ? "点词模式" : "键入模式"}
                  </span>
                  <span className="rounded-full border border-white/20 px-3 py-1 backdrop-blur">
                    难度 {currentStage.difficulty ?? "-"}
                  </span>
                  <span className="rounded-full border border-white/20 px-3 py-1 backdrop-blur">
                    连击 x{combo}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 items-center justify-center rounded-[28px] border border-white/10 bg-slate-950/30 p-3 sm:p-4">
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
                  />
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[0.7rem] uppercase tracking-[0.3em] text-white/40">
                <span>尝试 {attempts}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 via-rose-300 to-indigo-300 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span>失误 {stageMistakes}</span>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* 庆祝动画 */}
      {celebration && (
        <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur">
          <div className="absolute inset-0 bg-slate-950/60" />
          <div className="relative flex flex-col items-center rounded-3xl border border-white/10 bg-white/5 px-10 py-8 text-center shadow-[0_20px_80px_rgba(15,23,42,0.7)] backdrop-blur-xl">
            <div className="mb-4 flex gap-2 text-5xl">
              {[...Array(celebration.stars)].map((_, idx) => (
                <span key={idx} className="animate-bounce drop-shadow-xl" style={{ animationDelay: `${idx * 0.1}s` }}>
                  ⭐
                </span>
              ))}
            </div>
            <p className="text-sm uppercase tracking-[0.4em] text-white/50">Momentum</p>
            <h3 className="mt-2 text-3xl font-semibold text-white">{celebration.message}</h3>
            <p className="mt-2 text-white/70">连击 x{celebration.combo}</p>
          </div>
        </div>
      )}
    </div>
  );
};
