import React, { useEffect, useMemo, useRef } from "react";
import classNames from "classnames";
import { CheckCircle2, PlayCircle, Circle } from "lucide-react";
import type { CourseStage } from "../api/courses";

interface StagesProgressSidebarProps {
    stages: CourseStage[];
    currentIndex: number;
    className?: string;
}

const stripExtension = (value: string) => value.replace(/\.[a-z0-9]+$/i, "");
const tidySpaces = (value: string) =>
    value
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const buildUnitLabel = (stage: CourseStage) => {
    if (stage.unitName?.trim()) {
        return stage.unitName.trim();
    }
    if (typeof stage.unitNumber === "number") {
        return `Unit ${stage.unitNumber}`;
    }
    return "未分配单元";
};

const buildPageLabel = (stage: CourseStage) => {
    if (typeof stage.sourceAssetOrder === "number") {
        return `第 ${stage.sourceAssetOrder + 1} 页`;
    }
    if (stage.sourceAssetName?.trim()) {
        return tidySpaces(stripExtension(stage.sourceAssetName));
    }
    return "未标注页码";
};

const buildPageKey = (stage: CourseStage) => {
    const unitKey = stage.unitName ?? (typeof stage.unitNumber === "number" ? `unit-${stage.unitNumber}` : "unit-none");
    const pageKey = typeof stage.sourceAssetOrder === "number"
        ? `page-${stage.sourceAssetOrder}`
        : stage.lessonId;
    return `${unitKey}__${pageKey}`;
};

const buildUnitKey = (stage?: CourseStage) => {
    if (!stage) return "unit-none";
    if (typeof stage.unitNumber === "number") {
        return `num-${stage.unitNumber}`;
    }
    if (stage.unitName?.trim()) {
        return `name-${stage.unitName.trim()}`;
    }
    return "unit-none";
};

interface PageGroup {
    key: string;
    unitLabel: string;
    unitKey: string;
    pageLabel: string;
    stages: { stage: CourseStage; stageIndex: number }[];
}

export const StagesProgressSidebar: React.FC<StagesProgressSidebarProps> = ({
    stages,
    currentIndex,
    className
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeItemRef = useRef<HTMLDivElement | null>(null);

    const pageGroups = useMemo<PageGroup[]>(() => {
        const groups: PageGroup[] = [];
        const keyIndexMap = new Map<string, number>();

        stages.forEach((stage, stageIndex) => {
            const key = buildPageKey(stage);
            let targetIndex = keyIndexMap.get(key);
            if (targetIndex === undefined) {
                keyIndexMap.set(key, groups.length);
                groups.push({
                    key,
                    unitLabel: buildUnitLabel(stage),
                    unitKey: buildUnitKey(stage),
                    pageLabel: buildPageLabel(stage),
                    stages: []
                });
                targetIndex = groups.length - 1;
            }
            groups[targetIndex].stages.push({ stage, stageIndex });
        });

        return groups;
    }, [stages]);

    useEffect(() => {
        if (activeItemRef.current && scrollRef.current) {
            activeItemRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }, [currentIndex]);

    const currentStage = stages[currentIndex];
    const currentUnitKey = buildUnitKey(currentStage);
    const unitStages = useMemo(() => {
        if (!currentStage) return stages;
        return stages.filter(stage => buildUnitKey(stage) === currentUnitKey);
    }, [stages, currentUnitKey, currentStage]);
    const unitStageIndex = useMemo(() => {
        if (!currentStage) return currentIndex;
        const idx = unitStages.findIndex(stage => stage.id === currentStage.id);
        return idx >= 0 ? idx : currentIndex;
    }, [unitStages, currentStage, currentIndex]);

    const displayGroups = currentStage ? pageGroups.filter(group => group.unitKey === currentUnitKey) : pageGroups;
    const progressLabel = unitStages.length
        ? `${Math.max(1, unitStageIndex + 1)} / ${unitStages.length}`
        : `${currentIndex + 1} / ${stages.length}`;

    return (
        <div className={classNames("flex flex-col h-full bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm border-r border-white/60 dark:border-slate-700/60", className)}>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {displayGroups.map(group => (
                    <div
                        key={group.key}
                        className="rounded-3xl border border-white/80 dark:border-slate-700/80 bg-gradient-to-b from-white to-slate-50/70 dark:from-slate-800 dark:to-slate-900/70 p-4 shadow-sm space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-base font-black text-slate-900 dark:text-slate-100">{group.unitLabel}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-base font-black text-orange-500 dark:text-orange-400">{group.pageLabel}</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {group.stages.map(({ stage, stageIndex }) => {
                                const isCompleted = stageIndex < currentIndex;
                                const isCurrent = stageIndex === currentIndex;
                                const english = stage.promptEn || stage.answerEn || "";

                                return (
                                    <div
                                        key={stage.id}
                                        ref={isCurrent ? activeItemRef : null}
                                        className={classNames(
                                            "flex items-start gap-3 rounded-2xl border px-3 py-2 transition-all",
                                            isCurrent
                                                ? "border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/30 shadow-sm"
                                                : isCompleted
                                                    ? "border-transparent bg-white/70 dark:bg-slate-700/70 text-slate-400 dark:text-slate-500 line-through decoration-emerald-200 dark:decoration-emerald-800"
                                                    : "border-dashed border-slate-200 dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400"
                                        )}
                                    >
                                        <div className="mt-1">
                                            {isCompleted ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-500" />
                                            ) : isCurrent ? (
                                                <PlayCircle className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                                            ) : (
                                                <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <p className={classNames("text-sm font-semibold", isCurrent ? "text-slate-900 dark:text-slate-100" : undefined)}>
                                                {english || "未提供句子"}
                                            </p>
                                            {stage.promptCn && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {stage.promptCn}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
