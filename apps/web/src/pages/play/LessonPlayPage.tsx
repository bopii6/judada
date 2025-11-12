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

  const progressRatio = stages.length
    ? Math.min(stageIndex + 1 + (celebration ? 1 : 0), stages.length) / stages.length
    : 0;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-sky-500 via-indigo-600 to-purple-600 text-white">
      <header className="flex items-center justify-between px-10 pt-8">
        <button
          type="button"
          className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          onClick={handleBack}
        >
          ← 返回课程
        </button>
        <div className="text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-white/60">{currentStage.lessonTitle}</div>
          <h1 className="mt-2 text-3xl font-bold drop-shadow-lg">
            模式：{activeMode === "tiles" ? "点词成句" : "键入练习"}
          </h1>
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-white/70">
            <span>关卡 #{currentStage.stageSequence}</span>
            <span>进度 {stageIndex + 1} / {stages.length}</span>
            <span>Combo {combo}</span>
          </div>
        </div>
        <div className="text-right text-sm text-white/80">
          <div>最佳连击 {bestCombo}</div>
          <div>今日闯关 {attempts}</div>
        </div>
      </header>

      <div className="px-10 pt-6">
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white/80 transition-all"
            style={{ width: `${Math.round(progressRatio * 100)}%` }}
          />
        </div>
      </div>

      <main className="relative flex flex-1 flex-col px-10 pb-10">
        <div className="relative flex-1 overflow-hidden rounded-3xl bg-white/10 p-10 shadow-2xl backdrop-blur-xl">
          {completed ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-white">
              <div className="text-sm uppercase tracking-[0.4em] text-white/60">课程完成</div>
              <h2 className="text-4xl font-semibold drop-shadow-lg">太棒了！你完成了全部关卡。</h2>
              <p className="text-white/80">继续挑战其他课程或返回课程列表。</p>
              <div className="flex gap-4">
                <button
                  type="button"
                  className="rounded-full bg-white/90 px-6 py-3 text-sm font-semibold text-slate-900 shadow"
                  onClick={handleBack}
                >
                  返回课程
                </button>
              </div>
            </div>
          ) : (
            <>
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
              {celebration && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/60 backdrop-blur-sm">
                  <div className="flex gap-2 text-4xl drop-shadow-lg">
                    {[...Array(celebration.stars)].map((_, idx) => (
                      <span key={idx}>⭐</span>
                    ))}
                  </div>
                  <p className="text-lg font-semibold text-white">{celebration.message}</p>
                  <p className="text-sm text-white/70">连击 x{celebration.combo}</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};
