import type { CourseStage } from "../api/courses";
import { useMemo } from "react";
import { useProgressStore } from "../store/progressStore";

interface AdventureMapProps {
  courseId: string;
  stages: CourseStage[];
  onStart(stageId: string, mode?: "tiles" | "type"): void;
}

const starIcons = (count: number) =>
  [...Array(3)].map((_, index) => (
    <span key={index} className={index < count ? "text-yellow-400" : "text-white/50"}>
      ★
    </span>
  ));

export const AdventureMap = ({ courseId, stages, onStart }: AdventureMapProps) => {
  const progress = useProgressStore();

  const nodeStates = useMemo(() => {
    let previousCompleted = true;
    return stages.map(stage => {
      const record = progress.stages[stage.id];
      const completed = Boolean(record);
      const unlocked = completed || previousCompleted;
      previousCompleted = completed;
      return {
        stage,
        completed,
        unlocked,
        stars: record?.bestStars ?? 0
      };
    });
  }, [progress, stages]);

  if (!stages.length) {
    return (
      <div className="rounded-3xl bg-white/70 p-6 text-sm text-slate-500">
        当前课程还没有可玩的关卡，等老师发布后再来探索吧。
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-gradient-to-r from-sky-50 via-rose-50 to-amber-50 p-6 shadow-inner">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">冒险地图</p>
          <h2 className="text-2xl font-semibold text-slate-900">跟着轨道依次闯关</h2>
        </div>
        <div className="text-xs text-slate-500">
          课程 ID：<span className="font-mono text-slate-600">{courseId.slice(0, 6)}</span>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-6 md:flex-row md:flex-wrap md:gap-4">
        {nodeStates.map(({ stage, completed, unlocked, stars }, index) => (
          <div
            key={stage.id}
            className={`relative flex flex-1 min-w-[220px] flex-col rounded-2xl border bg-white/80 p-4 shadow transition ${
              completed
                ? "border-emerald-200 ring-2 ring-emerald-100"
                : unlocked
                  ? "border-amber-200"
                  : "border-slate-200 opacity-50"
            }`}
          >
            {index < nodeStates.length - 1 && (
              <div className="absolute -right-3 top-1/2 hidden h-0.5 w-6 -translate-y-1/2 bg-gradient-to-r from-slate-200 to-slate-400 md:block" />
            )}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>关卡 #{stage.stageSequence}</span>
              <span className="font-medium text-slate-600">
                {stage.type === "tiles"
                  ? "点词"
                  : stage.type === "type"
                    ? "键入"
                    : stage.type === "listenTap"
                      ? "听力"
                      : "练习"}
              </span>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{stage.lessonTitle}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{stage.promptCn}</p>
            <div className="mt-3 flex items-center gap-1 text-lg">
              {starIcons(stars)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow disabled:bg-slate-200"
                disabled={!unlocked}
                onClick={() => onStart(stage.id, "tiles")}
              >
                点词
              </button>
              <button
                type="button"
                className="rounded-full border border-primary/30 px-4 py-1.5 text-xs font-semibold text-primary disabled:border-slate-200 disabled:text-slate-300"
                disabled={!unlocked}
                onClick={() => onStart(stage.id, "type")}
              >
                键入
              </button>
            </div>
            {!unlocked && <p className="mt-2 text-xs text-slate-400">完成前一关即可解锁</p>}
            {completed && <p className="mt-2 text-xs text-emerald-500">最佳记录：{stars} 星</p>}
          </div>
        ))}
      </div>
    </div>
  );
};
