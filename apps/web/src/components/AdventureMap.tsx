import { useEffect, useMemo, useState } from "react";
import type { CourseStage } from "../api/courses";
import { useProgressStore } from "../store/progressStore";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Lock, Play, Sparkles, Star } from "lucide-react";

interface AdventureMapProps {
  stages: CourseStage[];
  onStart(stageId: string): void;
}

interface RoundData {
  roundNumber: number;
  title?: string | null;
  stages: CourseStage[];
}

interface UnitData {
  unitNumber: number;
  unitName: string;
  rounds: RoundData[];
}

type StageStatus = "locked" | "current" | "done" | "mastered";

const CARDS_PER_VIEW = 6;

const chunk = <T,>(items: T[], size: number): T[][] => {
  if (!items.length) return [];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

const getRoundSummary = (
  round: RoundData,
  progressMap: Record<string, { bestStars?: number } | undefined>
) => {
  const total = round.stages.length;
  let completed = 0;
  let stars = 0;
  round.stages.forEach(stage => {
    const record = progressMap[stage.id];
    if (record) {
      completed += 1;
      stars += record.bestStars ?? 0;
    }
  });
  return { total, completed, stars };
};

const isRoundCompleted = (round: RoundData, progressMap: Record<string, unknown>) =>
  round.stages.every(stage => Boolean(progressMap[stage.id]));

const isUnitCompleted = (unit: UnitData, progressMap: Record<string, unknown>) =>
  unit.rounds.every(round => isRoundCompleted(round, progressMap));

export const AdventureMap = ({ stages, onStart }: AdventureMapProps) => {
  const progress = useProgressStore();

  const units = useMemo<UnitData[]>(() => {
    if (!stages.length) return [];
    const grouped = new Map<number, CourseStage[]>();
    stages.forEach(stage => {
      const unitNumber = stage.unitNumber ?? 1;
      if (!grouped.has(unitNumber)) grouped.set(unitNumber, []);
      grouped.get(unitNumber)!.push(stage);
    });
    return Array.from(grouped.keys())
      .sort((a, b) => a - b)
      .map(unitNumber => {
        const unitStages = grouped.get(unitNumber)!;
        unitStages.sort((a, b) => a.stageSequence - b.stageSequence);
        const hasRoundMetadata = unitStages.some(stage => typeof stage.roundIndex === "number");

        let rounds: RoundData[] = [];
        if (hasRoundMetadata) {
          const roundMap = new Map<number, CourseStage[]>();
          unitStages.forEach(stage => {
            const roundIdx = stage.roundIndex ?? 1;
            if (!roundMap.has(roundIdx)) {
              roundMap.set(roundIdx, []);
            }
            roundMap.get(roundIdx)!.push(stage);
          });
          rounds = Array.from(roundMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([roundNumber, roundStages]) => {
              const sortedStages = roundStages.sort((a, b) => {
                const orderA = (a.roundOrder ?? a.stageSequence) ?? 0;
                const orderB = (b.roundOrder ?? b.stageSequence) ?? 0;
                if (orderA === orderB) {
                  return a.stageSequence - b.stageSequence;
                }
                return orderA - orderB;
              });
              const roundTitle = sortedStages[0]?.roundTitle ?? sortedStages[0]?.sourceAssetName ?? null;
              return {
                roundNumber,
                title: roundTitle ?? undefined,
                stages: sortedStages
              };
            });
        } else {
          for (let i = 0; i < unitStages.length; i += 16) {
            rounds.push({
              roundNumber: rounds.length + 1,
              title: undefined,
              stages: unitStages.slice(i, i + 16)
            });
          }
        }

        return {
          unitNumber,
          unitName: unitStages[0]?.unitName || `第 ${unitNumber} 单元`,
          rounds
        };
      });
  }, [stages]);

  const [expandedUnitIdx, setExpandedUnitIdx] = useState(0);
  const [roundIndexByUnit, setRoundIndexByUnit] = useState<Record<number, number>>({});
  const [slideIndexByRound, setSlideIndexByRound] = useState<Record<string, number>>({});
  const [userInteracted, setUserInteracted] = useState(false);

  useEffect(() => {
    if (!units.length) return;
    setRoundIndexByUnit(prev => {
      const next = { ...prev };
      let changed = false;
      units.forEach(unit => {
        if (typeof next[unit.unitNumber] !== "number") {
          const firstAvailable = unit.rounds.findIndex(round => !isRoundCompleted(round, progress.stages));
          next[unit.unitNumber] = firstAvailable === -1 ? Math.max(unit.rounds.length - 1, 0) : firstAvailable;
          changed = true;
        } else if (next[unit.unitNumber] >= unit.rounds.length) {
          next[unit.unitNumber] = Math.max(unit.rounds.length - 1, 0);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [units, progress.stages]);

  useEffect(() => {
    if (!units.length || userInteracted) return;
    const firstUnfinished = units.findIndex(unit => !isUnitCompleted(unit, progress.stages));
    setExpandedUnitIdx(firstUnfinished >= 0 ? firstUnfinished : units.length - 1);
  }, [units, progress.stages, userInteracted]);

  if (!units.length) return null;

  const handleToggleUnit = (idx: number) => {
    setUserInteracted(true);
    setExpandedUnitIdx(prev => (prev === idx ? -1 : idx));
  };

  const handleRoundChange = (unitNumber: number, roundNumber: number, idx: number) => {
    setUserInteracted(true);
    setRoundIndexByUnit(prev => ({ ...prev, [unitNumber]: idx }));
    setSlideIndexByRound(prev => ({ ...prev, [`${unitNumber}-${roundNumber}`]: 0 }));
  };

  const renderRoundSlider = (unit: UnitData, activeRoundIndex: number) => {
    const activeRound = unit.rounds[activeRoundIndex];
    if (!activeRound) return null;
    const summary = getRoundSummary(activeRound, progress.stages);
    const slides = chunk(activeRound.stages, CARDS_PER_VIEW);
    const sliderKey = `${unit.unitNumber}-${activeRound.roundNumber}`;
    const slideIndex = slideIndexByRound[sliderKey] ?? 0;
    const canPrev = slideIndex > 0;
    const canNext = slideIndex < slides.length - 1;
    const stageOrderMap = new Map(activeRound.stages.map((stage, index) => [stage.id, index]));

    const goSlide = (direction: "prev" | "next") => {
      if (direction === "prev" && canPrev) {
        setSlideIndexByRound(prev => ({ ...prev, [sliderKey]: slideIndex - 1 }));
      }
      if (direction === "next" && canNext) {
        setSlideIndexByRound(prev => ({ ...prev, [sliderKey]: slideIndex + 1 }));
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500">
          <span>第 {activeRound.roundNumber} 组 · {summary.total} 关卡</span>
          <span>已完成 {summary.completed}/{summary.total} ｜ 累积 {summary.stars} 星</span>
        </div>

        <div className="relative">
          {slides.length > 1 && (
            <>
              <button
                type="button"
                aria-label="上一组"
                onClick={() => goSlide("prev")}
                disabled={!canPrev}
                className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full border bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center transition-all ${
                  canPrev ? "text-slate-600 hover:scale-105" : "text-slate-300 cursor-not-allowed"
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label="下一组"
                onClick={() => goSlide("next")}
                disabled={!canNext}
                className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full border bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center transition-all ${
                  canNext ? "text-slate-600 hover:scale-105" : "text-slate-300 cursor-not-allowed"
                }`}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </>
          )}

          <div className="overflow-hidden rounded-[1.5rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div
              className="flex transition-transform duration-500"
              style={{ transform: `translateX(-${slideIndex * 100}%)` }}
            >
              {slides.map((slideStages, slideIdx) => (
                <div
                  key={`slide-${slideIdx}`}
                  className="w-full shrink-0 p-4 sm:p-6"
                >
                  <div className="flex gap-4">
                    {slideStages.map(stage => {
                      const record = progress.stages[stage.id];
                      const completed = Boolean(record);
                      const stars = record?.bestStars ?? 0;
                      const isMastered = completed && stars >= 3;
                      const stageIndex = stageOrderMap.get(stage.id) ?? 0;
                      const isFirstStage = stageIndex === 0;

                      let unlocked = completed;
                      if (!unlocked) {
                        if (isFirstStage) {
                          unlocked = true;
                        } else {
                          const prevStage = activeRound.stages[stageIndex - 1];
                          unlocked = Boolean(prevStage && progress.stages[prevStage.id]);
                        }
                      }

                      const status: StageStatus = isMastered
                        ? "mastered"
                        : completed
                          ? "done"
                          : unlocked
                            ? "current"
                            : "locked";

                      return (
                        <div key={stage.id} className="w-[180px] shrink-0">
                          <CheckpointCard
                            stage={stage}
                            displayNumber={stage.stageSequence}
                            stars={stars}
                            status={status}
                            onStart={() => unlocked && onStart(stage.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {slides.length > 1 && (
            <div className="mt-3 flex items-center justify-center gap-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSlideIndexByRound(prev => ({ ...prev, [sliderKey]: idx }))}
                  className={`h-1 rounded-full transition-all ${idx === slideIndex ? "w-10 bg-slate-900 dark:bg-white" : "w-4 bg-slate-200 dark:bg-slate-700"}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-500" />
          完成上一张卡牌即可继续，连续闯关即可解锁老师点评
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {units.map((unit, idx) => {
        const expanded = idx === expandedUnitIdx;
        const activeRoundIndex = roundIndexByUnit[unit.unitNumber] ?? 0;
        const unitSummary = unit.rounds.reduce(
          (acc, round) => {
            const summary = getRoundSummary(round, progress.stages);
            return {
              total: acc.total + summary.total,
              completed: acc.completed + summary.completed,
              stars: acc.stars + summary.stars
            };
          },
          { total: 0, completed: 0, stars: 0 }
        );

        return (
          <section
            key={unit.unitNumber}
            className="rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.08)] overflow-hidden"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleToggleUnit(idx)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleToggleUnit(idx);
                }
              }}
              className="w-full flex items-center justify-between gap-4 px-6 py-5 cursor-pointer focus:outline-none"
            >
              <div className="flex items-center gap-4 text-left">
                <span className="text-xs font-black tracking-[0.35em] text-orange-500">
                  第 {unit.unitNumber} 单元
                </span>
                <div>
                  <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">{unit.unitName}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div className="text-xs text-slate-500">
                  <p className="font-semibold text-slate-600 dark:text-slate-100">
                    {unitSummary.completed}/{unitSummary.total} 关卡 · {unit.rounds.length} 组练习
                  </p>
                  <p className="text-xs text-slate-400">任意单元第一关随时可练</p>
                </div>
                <div
                  className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${
                    expanded ? "border-slate-900 text-slate-900 dark:border-white dark:text-white rotate-180" : "border-slate-200 text-slate-400"
                  }`}
                >
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
            </div>

            {expanded && (
              <div className="px-6 pb-8 space-y-6">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {unit.rounds.map((round, roundIdx) => {
                    const summary = getRoundSummary(round, progress.stages);
                    const isActive = roundIdx === activeRoundIndex;
                    return (
                      <button
                        key={round.roundNumber}
                        type="button"
                        onClick={() => handleRoundChange(unit.unitNumber, round.roundNumber, roundIdx)}
                        className={`rounded-2xl border p-3 text-left transition-all ${
                          isActive ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
                        } hover:border-slate-400`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span>{round.title ?? `第 ${round.roundNumber} 组`}</span>
                          <span>{summary.completed}/{summary.total}</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-white/30">
                          <div
                            className={`h-full rounded-full ${isActive ? "bg-orange-300" : "bg-slate-300"}`}
                            style={{ width: `${summary.total ? (summary.completed / summary.total) * 100 : 0}%` }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] opacity-70">点击查看关卡</p>
                      </button>
                    );
                  })}
                </div>

                {renderRoundSlider(unit, activeRoundIndex)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

interface CheckpointCardProps {
  stage: CourseStage;
  displayNumber: number;
  stars: number;
  status: StageStatus;
  onStart: () => void;
}

const ellipsis = (text: string | undefined, max = 24) => {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

const CheckpointCard = ({ stage, displayNumber, stars, status, onStart }: CheckpointCardProps) => {
  const isLocked = status === "locked";
  const isDone = status === "done";
  const isMaster = status === "mastered";

  const actionLabel = isLocked
    ? "完成上一关解锁"
    : isMaster
      ? "挑战大师分"
      : isDone
        ? "已获得点评"
        : "开始闯关";

  const actionIcon = isLocked ? (
    <Lock className="w-4 h-4" />
  ) : isDone ? (
    <CheckCircle2 className="w-4 h-4" />
  ) : (
    <Play className="w-4 h-4 fill-current" />
  );

  const englishSnippet = stage.promptEn || stage.answerEn || stage.lessonTitle || stage.sourceAssetName || stage.promptCn || "";
  const subtitle = ellipsis(englishSnippet, 30);

  const styleMap: Record<StageStatus, string> = {
    locked: "border-slate-200 text-slate-400 bg-slate-50/70 cursor-not-allowed",
    current: "border-orange-300 bg-orange-50 text-orange-700 shadow-[0_12px_30px_rgba(251,146,60,0.25)]",
    done: "border-emerald-200 bg-emerald-50 text-emerald-700",
    mastered: "border-purple-300 bg-purple-50 text-purple-700 shadow-[0_12px_30px_rgba(168,85,247,0.25)]"
  };

  return (
    <button
      type="button"
      disabled={isLocked}
      onClick={() => !isLocked && onStart()}
      className={`h-full rounded-2xl border p-4 flex flex-col gap-3 text-left transition-all ${styleMap[status]}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-black tracking-[0.35em]">#{displayNumber.toString().padStart(2, "0")}</span>
        {isMaster && (
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-100 text-purple-600 font-black uppercase">
            MASTER
          </span>
        )}
      </div>

      <p className="text-base font-semibold text-slate-800">{subtitle || `第 ${displayNumber} 关`}</p>
      <p className="text-xs text-slate-400">第 {displayNumber} 关</p>

      <div className="mt-auto flex items-center justify-between text-xs font-bold">
        <span className="inline-flex items-center gap-1">
          {actionIcon}
          {actionLabel}
        </span>
        {stars > 0 && (
          <span className="flex items-center gap-0.5 text-amber-500">
            {[...Array(Math.min(stars, 3))].map((_, idx) => (
              <Star key={idx} className="w-3 h-3 fill-current" />
            ))}
          </span>
        )}
      </div>
    </button>
  );
};
