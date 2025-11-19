import React, { useMemo } from "react";
import { DailyQuestBoard } from "../components/DailyQuestBoard";
import { useProgressStore } from "../store/progressStore";
import { SyncStatus } from "../components/SyncStatus";
import { Sparkles, Star, Flag, Zap } from "lucide-react";

export const Dashboard: React.FC = () => {
  const progress = useProgressStore();

  const progressSummary = useMemo(() => {
    const records = Object.values(progress.stages);
    const totalStars = records.reduce((sum, record) => sum + record.bestStars, 0);
    const totalStages = records.length;
    return { totalStars, totalStages };
  }, [progress]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <SyncStatus />

      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 px-8 py-10 shadow-xl text-white">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-yellow-300/30 rounded-full blur-3xl"></div>

        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm border border-white/10">
              <Sparkles className="w-3 h-3" />
              <span>Welcome Back</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              准备好开始今天的<br />英语探险了吗？
            </h1>
            <p className="text-white/90 font-medium max-w-md">
              每一次练习都是一次成长。保持节奏，享受过程！
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-3xl bg-white/15 px-6 py-4 backdrop-blur-md border border-white/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-lg">
              🚀
            </div>
            <div>
              <p className="text-xs text-white/80 font-bold uppercase tracking-wider">Total Progress</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black">{progressSummary.totalStages}</span>
                <span className="text-sm font-medium text-white/80">关卡达成</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stats Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Stars Card */}
          <div className="rounded-[2rem] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:-translate-y-1 transition-transform duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-2xl bg-amber-100 text-amber-500">
                <Star className="w-6 h-6 fill-current" />
              </div>
              <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">ALL TIME</span>
            </div>
            <p className="text-4xl font-black text-slate-800 mb-1">{progressSummary.totalStars}</p>
            <p className="text-sm text-slate-500 font-medium">累计获得星星</p>
          </div>

          {/* Streak Card (Mockup) */}
          <div className="rounded-[2rem] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:-translate-y-1 transition-transform duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-2xl bg-orange-100 text-orange-500">
                <Zap className="w-6 h-6 fill-current" />
              </div>
              <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">STREAK</span>
            </div>
            <p className="text-4xl font-black text-slate-800 mb-1">3</p>
            <p className="text-sm text-slate-500 font-medium">连续打卡天数</p>
          </div>
        </div>

        {/* Main Content Column */}
        <div className="lg:col-span-2">
          <DailyQuestBoard />
        </div>
      </div>
    </div>
  );
};
