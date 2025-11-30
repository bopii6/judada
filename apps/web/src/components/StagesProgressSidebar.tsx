import React, { useEffect, useMemo, useRef } from "react";
import classNames from "classnames";
import { CheckCircle2, PlayCircle, Circle, Map as MapIcon } from "lucide-react";
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

interface PageGroup {
    key: string;
    unitLabel: string;
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

    return (
        <div className={classNames("flex flex-col h-full bg-white/40 backdrop-blur-sm border-r border-white/60", className)}>
            <div className="p-6 border-b border-white/40">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <MapIcon className="w-5 h-5 text-indigo-500" />
                    <span>关卡地图</span>
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
                    已完成 {currentIndex + 1} / {stages.length}
                </p>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {pageGroups.map(group => (
                    <div
                        key={group.key}
                        className="rounded-3xl border border-white/80 bg-gradient-to-b from-white to-slate-50/70 p-4 shadow-sm space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">单元</p>
                                <p className="text-base font-black text-slate-900 mt-1">{group.unitLabel}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">页码</p>
                                <p className="text-base font-black text-indigo-500 mt-1">{group.pageLabel}</p>
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
                                                ? "border-indigo-300 bg-indigo-50 shadow-sm"
                                                : isCompleted
                                                    ? "border-transparent bg-white/70 text-slate-400 line-through decoration-emerald-200"
                                                    : "border-dashed border-slate-200 bg-white/40 text-slate-500"
                                        )}
                                    >
                                        <div className="mt-1">
                                            {isCompleted ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            ) : isCurrent ? (
                                                <PlayCircle className="w-4 h-4 text-indigo-500" />
                                            ) : (
                                                <Circle className="w-4 h-4 text-slate-300" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <p className={classNames("text-sm font-semibold", isCurrent ? "text-slate-900" : undefined)}>
                                                {english || "未提供句子"}
                                            </p>
                                            {stage.promptCn && (
                                                <p className="text-xs text-slate-500">
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
