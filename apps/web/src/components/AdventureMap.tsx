import type { CourseStage } from "../api/courses";
import { useMemo, useState } from "react";
import { useProgressStore } from "../store/progressStore";
import { Map as MapIcon, Star, Lock, ArrowRight, ChevronDown, ChevronRight } from "lucide-react";

interface AdventureMapProps {
  stages: CourseStage[];
  onStart(stageId: string): void;
}

interface UnitGroup {
  unitNumber: number | null;
  unitName: string | null;
  stages: CourseStage[];
}

const getUnitKey = (stage: CourseStage) => {
  if (typeof stage.unitNumber === "number") {
    return `num-${stage.unitNumber}`;
  }
  if (stage.unitName?.trim()) {
    return `name-${stage.unitName.trim()}`;
  }
  return "unit-none";
};

export const AdventureMap = ({ stages, onStart }: AdventureMapProps) => {
  const progress = useProgressStore();

  // 按单元分组
  const unitGroups = useMemo<UnitGroup[]>(() => {
    const groups: Map<number | null, UnitGroup> = new Map();

    stages.forEach(stage => {
      const unitNum = stage.unitNumber ?? null;
      if (!groups.has(unitNum)) {
        groups.set(unitNum, {
          unitNumber: unitNum,
          unitName: stage.unitName ?? null,
          stages: []
        });
      }
      groups.get(unitNum)!.stages.push(stage);
    });

    // 按单元序号排序
    return Array.from(groups.values()).sort((a, b) => {
      if (a.unitNumber === null) return 1;
      if (b.unitNumber === null) return -1;
      return a.unitNumber - b.unitNumber;
    });
  }, [stages]);

  // 是否有多个单元
  const hasMultipleUnits = unitGroups.length > 1 || (unitGroups.length === 1 && unitGroups[0].unitNumber !== null);

  // 展开/折叠状态
  const [expandedUnits, setExpandedUnits] = useState<Set<number | null>>(() => {
    // 默认展开第一个单元
    if (unitGroups.length > 0) {
      return new Set([unitGroups[0].unitNumber]);
    }
    return new Set();
  });

  const toggleUnit = (unitNumber: number | null) => {
    setExpandedUnits(prev => {
      const next = new Set(prev);
      if (next.has(unitNumber)) {
        next.delete(unitNumber);
      } else {
        next.add(unitNumber);
      }
      return next;
    });
  };

  const nodeStates = useMemo(() => {
    const unitProgressState = new Map<string, boolean>();
    return stages.map(stage => {
      const record = progress.stages[stage.id];
      const completed = Boolean(record);
      const unitKey = getUnitKey(stage);
      const canEnter = unitProgressState.get(unitKey) ?? true;
      const unlocked = completed || canEnter;
      unitProgressState.set(unitKey, completed);
      return {
        stage,
        completed,
        unlocked,
        stars: record?.bestStars ?? 0
      };
    });
  }, [progress, stages]);

  // 获取单元内关卡的状态
  const getUnitProgress = (unitStages: CourseStage[]) => {
    let completed = 0;
    const total = unitStages.length;
    unitStages.forEach(stage => {
      if (progress.stages[stage.id]) {
        completed++;
      }
    });
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  if (!stages.length) return null;

  // 如果只有一个单元或没有单元信息，使用原来的平铺展示
  if (!hasMultipleUnits) {
    return (
      <div className="rounded-[2.5rem] bg-white dark:bg-slate-800 p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-slate-100 dark:border-slate-700 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 via-orange-400 to-amber-400"></div>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400">
            <MapIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">冒险地图</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">跟着路线，一步步征服英语世界！</p>
          </div>
        </div>

        <div className="relative">
          {/* Connecting Line (Desktop) */}
          <div className="absolute top-1/2 left-0 w-full h-3 bg-slate-100 dark:bg-slate-700 -translate-y-1/2 rounded-full hidden md:block z-0"></div>

          <div className="flex flex-col gap-6 md:flex-row md:overflow-x-auto md:pb-8 md:pt-4 md:px-2 no-scrollbar relative z-10">
            {nodeStates.map(({ stage, completed, unlocked, stars }, index) => (
              <StageCard
                key={stage.id}
                stage={stage}
                completed={completed}
                unlocked={unlocked}
                stars={stars}
                showArrow={index < nodeStates.length - 1}
                onStart={onStart}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 多单元分组展示
  return (
    <div className="rounded-[2.5rem] bg-white dark:bg-slate-800 p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-slate-100 dark:border-slate-700 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 via-orange-400 to-amber-400"></div>

      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400">
          <MapIcon className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">冒险地图</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">按单元学习，循序渐进征服英语世界！</p>
        </div>
      </div>

      <div className="space-y-4">
        {unitGroups.map((group, groupIndex) => {
          const isExpanded = expandedUnits.has(group.unitNumber);
          const unitProgress = getUnitProgress(group.stages);
          const unitNodeStates = nodeStates.filter(ns =>
            group.stages.some(s => s.id === ns.stage.id)
          );

          return (
            <div key={group.unitNumber ?? 'default'} className="border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden">
              {/* Unit Header */}
              <button
                onClick={() => toggleUnit(group.unitNumber)}
                className="w-full flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors text-left"
              >
                <div className={`p-2 rounded-xl ${unitProgress.percentage === 100 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'}`}>
                  {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">
                      {group.unitName || `单元 ${group.unitNumber ?? groupIndex + 1}`}
                    </h3>
                    {unitProgress.percentage === 100 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                        已完成
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {group.stages.length} 个关卡 · 已完成 {unitProgress.completed}/{unitProgress.total}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="hidden sm:flex items-center gap-3 w-32">
                  <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${unitProgress.percentage === 100 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                      style={{ width: `${unitProgress.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-8">{unitProgress.percentage}%</span>
                </div>
              </button>

              {/* Unit Content */}
              {isExpanded && (
                <div className="p-4 bg-white dark:bg-slate-800">
                  <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto md:pb-4 md:px-2 no-scrollbar">
                    {unitNodeStates.map(({ stage, completed, unlocked, stars }, index) => (
                      <StageCard
                        key={stage.id}
                        stage={stage}
                        completed={completed}
                        unlocked={unlocked}
                        stars={stars}
                        showArrow={index < unitNodeStates.length - 1}
                        onStart={onStart}
                        compact
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 关卡卡片组件
interface StageCardProps {
  stage: CourseStage;
  completed: boolean;
  unlocked: boolean;
  stars: number;
  showArrow: boolean;
  onStart: (stageId: string) => void;
  compact?: boolean;
}

const StageCard = ({ stage, completed, unlocked, stars, showArrow, onStart, compact }: StageCardProps) => {
  const englishSentence = (stage.promptEn || stage.answerEn || "").trim();
  const translation = (stage.promptCn || "").trim();
  const pageNumber = typeof stage.sourceAssetOrder === "number" ? stage.sourceAssetOrder + 1 : null;

  return (
    <div
      className={`relative flex-shrink-0 flex flex-col items-center text-center group transition-all duration-300 ${unlocked ? "opacity-100" : "opacity-60 grayscale"}`}
      style={{ width: compact ? '200px' : '240px' }}
    >
      {/* Node Circle */}
      <button
        onClick={() => unlocked && onStart(stage.id)}
        disabled={!unlocked}
        className={`${compact ? 'w-14 h-14 rounded-xl text-lg' : 'w-20 h-20 rounded-[2rem] text-2xl'} flex items-center justify-center font-black shadow-lg transition-transform duration-300 mb-3 relative z-10 ${completed
          ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white scale-110 shadow-emerald-200"
          : unlocked
            ? "bg-white dark:bg-slate-700 border-4 border-orange-100 dark:border-orange-800 text-orange-500 dark:text-orange-400 hover:scale-110 hover:border-orange-200 dark:hover:border-orange-700 hover:shadow-xl hover:shadow-orange-100 dark:hover:shadow-orange-900/30"
            : "bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed"
          }`}
      >
        {unlocked ? (
          completed ? (
            <Star className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} fill-white`} />
          ) : (
            stage.stageSequence
          )
        ) : (
          <Lock className={`${compact ? 'w-5 h-5' : 'w-8 h-8'}`} />
        )}

        {/* Stars Badge */}
        {stars > 0 && (
          <div className="absolute -bottom-1 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 flex gap-0.5">
            {[...Array(stars)].map((_, i) => (
              <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
            ))}
          </div>
        )}
      </button>

      {/* Content */}
      <div
        className={`bg-white dark:bg-slate-800 ${compact ? 'p-3' : 'p-4'} rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm w-full group-hover:shadow-md transition-shadow cursor-pointer flex flex-col`}
        style={{ height: compact ? '160px' : '180px' }}
        onClick={() => unlocked && onStart(stage.id)}
      >
        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mb-2 flex-shrink-0">
          <div className="text-left">
            <p className="font-semibold text-slate-500 dark:text-slate-400">单元</p>
            <p className="text-slate-800 dark:text-slate-100 font-bold">{stage.unitName || `Unit ${stage.unitNumber ?? "?"}`}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-500 dark:text-slate-400">页码</p>
            <p className="text-slate-800 dark:text-slate-100 font-bold">{pageNumber ? `第 ${pageNumber} 页` : "未标注"}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center mb-2 min-h-0">
          <h3 className={`font-bold text-slate-800 dark:text-slate-100 mb-1 ${compact ? 'text-sm' : 'text-base'} line-clamp-2`}>
            {englishSentence || "暂无句子"}
          </h3>
          {translation && (
            <p className={`text-slate-500 dark:text-slate-400 font-medium line-clamp-2 ${compact ? 'text-xs' : 'text-xs'}`}>
              {translation}
            </p>
          )}
        </div>

        <div className="flex justify-center mt-auto pt-2 border-t border-slate-50 dark:border-slate-700/50 flex-shrink-0">
          <span className={`text-xs font-bold ${unlocked ? "text-orange-500 dark:text-orange-400" : "text-slate-400 dark:text-slate-500"}`}>
            {unlocked ? "点击开始" : "完成上一关解锁"}
          </span>
        </div>
      </div>

      {/* Arrow for mobile */}
      {showArrow && (
        <div className="md:hidden my-2 text-slate-300 dark:text-slate-600">
          <ArrowRight className="w-5 h-5 rotate-90" />
        </div>
      )}
    </div>
  );
};
