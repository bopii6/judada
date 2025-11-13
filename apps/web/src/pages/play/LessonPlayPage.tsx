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
    <div className="flex min-h-screen bg-gradient-to-br from-pink-400 via-purple-400 to-indigo-400 text-white overflow-hidden">
      {/* 动态背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-32 h-32 bg-yellow-300/20 rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '3s' }}></div>
        <div className="absolute top-40 right-32 w-24 h-24 bg-blue-300/20 rounded-full animate-bounce" style={{ animationDelay: '1s', animationDuration: '4s' }}></div>
        <div className="absolute bottom-20 left-40 w-28 h-28 bg-green-300/20 rounded-full animate-bounce" style={{ animationDelay: '2s', animationDuration: '3.5s' }}></div>
        <div className="absolute bottom-40 right-20 w-20 h-20 bg-pink-300/20 rounded-full animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '2.5s' }}></div>
      </div>

      {/* 顶部状态栏 */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <button
          type="button"
          className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg font-bold hover:bg-white/30 transition-all hover:scale-110 shadow-lg"
          onClick={handleBack}
        >
          ←
        </button>

        <div className="text-center">
          <div className="text-xs font-bold text-white/80 mb-1">{currentStage.lessonTitle}</div>
          <div className="flex items-center justify-center gap-3">
            <div className="bg-yellow-400/30 backdrop-blur-sm px-3 py-1 rounded-full">
              <span className="text-sm font-bold">关卡 {currentStage.stageSequence}</span>
            </div>
            <div className="bg-green-400/30 backdrop-blur-sm px-3 py-1 rounded-full">
              <span className="text-sm font-bold">⚡ {combo}</span>
            </div>
            <div className="bg-blue-400/30 backdrop-blur-sm px-3 py-1 rounded-full">
              <span className="text-sm font-bold">🔥 {bestCombo}</span>
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs font-bold text-white/80 mb-1">进度</div>
          <div className="text-lg font-bold">{stageIndex + 1}/{stages.length}</div>
        </div>
      </header>

      {/* 进度条 */}
      <div className="relative z-10 px-6">
        <div className="h-3 w-full overflow-hidden rounded-full bg-white/20 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-green-400 transition-all duration-500 shadow-lg"
            style={{ width: `${Math.round(progressRatio * 100)}%` }}
          />
        </div>
      </div>

      {/* 主要游戏区域 */}
      <main className="relative z-10 flex-1 flex px-6 py-6">
        <div className="flex-1 flex flex-col">
          {completed ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-center mb-8">
                <div className="text-6xl mb-4 animate-bounce">🎉</div>
                <h2 className="text-4xl font-bold mb-2 text-yellow-100">太棒啦！</h2>
                <p className="text-xl text-white/90">你完成了所有关卡！</p>
                <div className="flex justify-center gap-2 mt-4">
                  {[...Array(3)].map((_, i) => (
                    <span key={i} className="text-4xl animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}>⭐</span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="bg-white text-purple-600 px-8 py-4 rounded-full text-xl font-bold hover:scale-110 transition-all shadow-xl"
                onClick={handleBack}
              >
                继续冒险 →
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 flex items-center justify-center">
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
            </>
          )}
        </div>
      </main>

      {/* 底部装饰 */}
      <div className="relative z-10 h-16 flex items-center justify-center">
        <div className="text-white/60 text-sm">
          {activeMode === "tiles" ? "🎯 点词成句" : "⌨️ 键入练习"}
        </div>
      </div>

      {/* 庆祝动画 */}
      {celebration && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div className="relative text-center">
            <div className="flex gap-3 mb-4 justify-center">
              {[...Array(celebration.stars)].map((_, idx) => (
                <span
                  key={idx}
                  className="text-6xl animate-bounce drop-shadow-2xl"
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >⭐</span>
              ))}
            </div>
            <h3 className="text-3xl font-bold text-yellow-300 mb-2 drop-shadow-lg">{celebration.message}</h3>
            <p className="text-xl text-white/90">连击 x{celebration.combo}</p>
            <div className="mt-4">
              {celebration.stars === 3 && <span className="text-4xl">🏆</span>}
              {celebration.stars === 2 && <span className="text-4xl">🥈</span>}
              {celebration.stars === 1 && <span className="text-4xl">🥉</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
