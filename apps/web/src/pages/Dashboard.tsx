import React, { useMemo } from "react";
import { DailyQuestBoard } from "../components/DailyQuestBoard";
import { useProgressStore } from "../store/progressStore";
import { SyncStatus } from "../components/SyncStatus";

export const Dashboard: React.FC = () => {
  const progress = useProgressStore();

  const progressSummary = useMemo(() => {
    const records = Object.values(progress.stages);
    const totalStars = records.reduce((sum, record) => sum + record.bestStars, 0);
    const totalStages = records.length;
    return { totalStars, totalStages };
  }, [progress]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <SyncStatus />

      <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500 px-6 py-8 shadow-lg text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-indigo-100/80">Today</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">你的英语成长仪表盘</h1>
            <p className="mt-2 text-sm text-indigo-100/90">专注输出 + 精准反馈，一起把进步变成日常。</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-lg">✨</div>
            <div>
              <p className="text-xs text-indigo-100/80">今日进度</p>
              <p className="text-lg font-semibold">
                {progressSummary.totalStages} 关 · {progressSummary.totalStars} 星
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-slate-200/70 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">已完成关卡</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{progressSummary.totalStages}</p>
          <p className="mt-1 text-sm text-slate-500">保持节奏，复习比新增更重要</p>
        </div>

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-slate-200/70 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">获得星星</p>
          <p className="mt-2 text-3xl font-semibold text-amber-500">{progressSummary.totalStars}</p>
          <p className="mt-1 text-sm text-slate-500">连胜越久，星星越亮</p>
        </div>
      </div>

      <DailyQuestBoard />
    </div>
  );
};
