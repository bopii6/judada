import React, { useMemo } from "react";
import { useProgressStore } from "../store/progressStore";
import { SyncStatus } from "../components/SyncStatus";
import { Sparkles, Star, Zap, Play } from "lucide-react";
import { StickerAlbum } from "../components/StickerAlbum";
import { Link } from "react-router-dom";

export const Dashboard: React.FC = () => {
  const progress = useProgressStore();

  const progressSummary = useMemo(() => {
    const records = Object.values(progress.stages);
    const totalStars = records.reduce((sum, record) => sum + record.bestStars, 0);
    const totalStages = records.length;
    return { totalStars, totalStages };
  }, [progress]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <SyncStatus />

      {/* Hero Section - The Collector's Desk */}
      <section className="relative overflow-hidden rounded-[3rem] bg-violet-500 px-8 py-12 shadow-xl shadow-violet-200 text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent bg-[length:20px_20px]" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-5xl shadow-lg animate-bounce-slow border-4 border-violet-200">
                🎒
              </div>
              <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-white p-2 rounded-full shadow-md rotate-12">
                <Star className="w-5 h-5 fill-current" />
              </div>
            </div>
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold backdrop-blur-sm border border-white/20 shadow-sm">
                <Sparkles className="w-4 h-4 text-yellow-300 fill-current" />
                <span>小小收藏家</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight drop-shadow-sm">
                我的贴纸书
              </h1>
              <p className="text-white/90 font-bold text-lg max-w-md">
                快来收集所有贴纸！玩游戏赢取新卡包。
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 bg-white/10 p-4 rounded-[2rem] backdrop-blur-md border border-white/20">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                🎁
              </div>
              <div>
                <div className="text-2xl font-black">2 个卡包</div>
                <div className="text-xs font-bold opacity-80 uppercase tracking-wider">待开启！</div>
              </div>
            </div>
            <Link
              to="/lab/music"
              className="flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-violet-900 px-8 py-4 rounded-2xl font-black uppercase tracking-wider shadow-lg shadow-yellow-400/30 transition-transform hover:scale-105 active:scale-95"
            >
              <Play className="w-5 h-5 fill-current" />
              去玩游戏赢奖励
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Sticker Album */}
        <div className="lg:col-span-8 space-y-8">
          <StickerAlbum />
        </div>

        {/* Right Column: Stats */}
        <div className="lg:col-span-4 space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-[2rem] bg-white p-5 shadow-sm border border-slate-100 text-center">
              <div className="text-3xl font-black text-slate-800 mb-1">{progressSummary.totalStars}</div>
              <div className="text-xs font-bold text-slate-400 uppercase">星星</div>
            </div>
            <div className="rounded-[2rem] bg-white p-5 shadow-sm border border-slate-100 text-center">
              <div className="text-3xl font-black text-slate-800 mb-1">3</div>
              <div className="text-xs font-bold text-slate-400 uppercase">连续打卡</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
