import type { CourseStage } from "../api/courses";
import { useMemo } from "react";
import { useProgressStore } from "../store/progressStore";
import { Map, Star, Lock, ArrowRight } from "lucide-react";

interface AdventureMapProps {
  courseId: string;
  stages: CourseStage[];
  onStart(stageId: string, mode?: "tiles" | "type"): void;
}

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

  if (!stages.length) return null;

  return (
    <div className="rounded-[2.5rem] bg-white p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400"></div>

      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-sky-100 text-sky-500">
          <Map className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800">冒险地图</h2>
          <p className="text-sm text-slate-500 font-medium">跟着路线，一步步征服英语世界！</p>
        </div>
      </div>

      <div className="relative">
        {/* Connecting Line (Desktop) */}
        <div className="absolute top-1/2 left-0 w-full h-3 bg-slate-100 -translate-y-1/2 rounded-full hidden md:block z-0"></div>

        <div className="flex flex-col gap-6 md:flex-row md:overflow-x-auto md:pb-8 md:pt-4 md:px-2 no-scrollbar relative z-10">
          {nodeStates.map(({ stage, completed, unlocked, stars }, index) => (
            <div
              key={stage.id}
              className={`relative flex-shrink-0 w-full md:w-64 flex flex-col items-center text-center group transition-all duration-300 ${unlocked ? "opacity-100" : "opacity-60 grayscale"
                }`}
            >
              {/* Node Circle */}
              <button
                onClick={() => unlocked && onStart(stage.id, "tiles")}
                disabled={!unlocked}
                className={`w-20 h-20 rounded-[2rem] flex items-center justify-center text-2xl font-black shadow-lg transition-transform duration-300 mb-4 relative z-10 ${completed
                    ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white scale-110 shadow-emerald-200"
                    : unlocked
                      ? "bg-white border-4 border-indigo-100 text-indigo-500 hover:scale-110 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100"
                      : "bg-slate-100 text-slate-300 cursor-not-allowed"
                  }`}
              >
                {unlocked ? (
                  completed ? (
                    <Star className="w-8 h-8 fill-white" />
                  ) : (
                    stage.stageSequence
                  )
                ) : (
                  <Lock className="w-8 h-8" />
                )}

                {/* Stars Badge */}
                {stars > 0 && (
                  <div className="absolute -bottom-2 bg-white px-2 py-0.5 rounded-full shadow-sm border border-slate-100 flex gap-0.5">
                    {[...Array(stars)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                )}
              </button>

              {/* Content */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm w-full md:w-56 group-hover:shadow-md transition-shadow">
                <h3 className="font-bold text-slate-800 mb-1 truncate">{stage.lessonTitle}</h3>
                <p className="text-xs text-slate-500 font-medium line-clamp-2 h-8 mb-3">
                  {stage.promptCn}
                </p>

                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => onStart(stage.id, "tiles")}
                    disabled={!unlocked}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    点词
                  </button>
                  <button
                    onClick={() => onStart(stage.id, "type")}
                    disabled={!unlocked}
                    className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    拼写
                  </button>
                </div>
              </div>

              {/* Arrow for mobile */}
              {index < nodeStates.length - 1 && (
                <div className="md:hidden my-2 text-slate-300">
                  <ArrowRight className="w-6 h-6 rotate-90" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
