import React, { useMemo } from "react";
import { useProgressStore } from "../store/progressStore";
import { SyncStatus } from "../components/SyncStatus";
import { Sparkles, Star, Play } from "lucide-react";
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
      <section className="relative overflow-hidden rounded-3xl bg-violet-500 px-6 py-6 shadow-xl shadow-violet-200 text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent bg-[length:20px_20px]" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl shadow-lg animate-bounce-slow border-4 border-violet-200">
                🎒
              </div>
              <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-white p-1.5 rounded-full shadow-md rotate-12">
                <Star className="w-3 h-3 fill-current" />
              </div>
            </div>
            <div className="space-y-1 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm border border-white/20 shadow-sm">
                <Sparkles className="w-3 h-3 text-yellow-300 fill-current" />
                <span>小小收藏家</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight drop-shadow-sm">
                我的贴纸书
              </h1>
              <p className="text-white/90 font-bold text-sm max-w-md">
                快来收集所有贴纸！玩游戏赢取新卡包。
              </p>
            </div>
          </div>

          <div className="flex flex-row items-center gap-3">
            <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-md border border-white/20">
              <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-lg shadow-sm">
                🎁
              </div>
              <div>
                <div className="text-lg font-black">2 个卡包</div>
                <div className="text-[10px] font-bold opacity-80 uppercase tracking-wider">待开启！</div>
              </div>
            </div>
            <Link
              to="/lab/music"
              className="flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-violet-900 px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider shadow-lg shadow-yellow-400/30 transition-transform hover:scale-105 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              去玩游戏
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
