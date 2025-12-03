import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { useProgressStore, getUserStats } from "../../store/progressStore";
import { Trophy, Star, Flame, Share2, Crown } from "lucide-react";

export const StudentProfileHero: React.FC = () => {
    const { getUserDisplayName, getUserAvatar } = useAuth();
    const userStats = getUserStats();
    const progress = useProgressStore();

    // Calculate level based on total stars (mock logic for now)
    const level = Math.floor((userStats?.totalStars || 0) / 50) + 1;
    const nextLevelStars = level * 50;
    const progressToNextLevel = ((userStats?.totalStars || 0) % 50) / 50 * 100;

    return (
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-orange-500 via-orange-400 to-amber-500 text-white shadow-xl shadow-orange-500/20">
            {/* Background Patterns */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-amber-300/20 rounded-full blur-2xl" />

            <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
                {/* Avatar Section */}
                <div className="relative shrink-0">
                    <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-white/30 p-1 bg-white/10 backdrop-blur-sm">
                        <img
                            src={getUserAvatar()}
                            alt={getUserDisplayName()}
                            className="w-full h-full rounded-full object-cover bg-white"
                        />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-orange-700 text-xs font-black px-3 py-1 rounded-full border-2 border-white shadow-sm flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        LV.{level}
                    </div>
                </div>

                {/* Info Section */}
                <div className="flex-1 text-center md:text-left space-y-4 w-full">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
                            {getUserDisplayName()}
                        </h1>
                        <div className="flex items-center justify-center md:justify-start gap-2 text-orange-50 font-medium">
                            <span className="bg-white/20 px-3 py-1 rounded-lg text-sm backdrop-blur-sm">
                                小小英语探险家
                            </span>
                            <span className="bg-white/20 px-3 py-1 rounded-lg text-sm backdrop-blur-sm">
                                已加入 {Math.floor((Date.now() - 1704067200000) / (1000 * 60 * 60 * 24))} 天
                            </span>
                        </div>
                    </div>

                    {/* Level Progress */}
                    <div className="max-w-md mx-auto md:mx-0">
                        <div className="flex items-center justify-between text-xs font-bold text-orange-100 mb-1.5">
                            <span>当前等级进度</span>
                            <span>{userStats?.totalStars || 0} / {nextLevelStars} 星星</span>
                        </div>
                        <div className="h-3 bg-black/10 rounded-full overflow-hidden backdrop-blur-sm">
                            <div
                                className="h-full bg-white rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                style={{ width: `${progressToNextLevel}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 md:gap-6 w-full md:w-auto shrink-0">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 text-center border border-white/10 min-w-[90px]">
                        <div className="flex justify-center mb-1">
                            <Star className="w-6 h-6 text-yellow-300 fill-yellow-300" />
                        </div>
                        <div className="text-2xl font-black">{userStats?.totalStars || 0}</div>
                        <div className="text-xs text-orange-100 font-bold">总星星</div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 text-center border border-white/10 min-w-[90px]">
                        <div className="flex justify-center mb-1">
                            <Flame className="w-6 h-6 text-orange-200 fill-orange-200" />
                        </div>
                        <div className="text-2xl font-black">{userStats?.currentStreak || 0}</div>
                        <div className="text-xs text-orange-100 font-bold">连续打卡</div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 text-center border border-white/10 min-w-[90px]">
                        <div className="flex justify-center mb-1">
                            <Trophy className="w-6 h-6 text-yellow-200" />
                        </div>
                        <div className="text-2xl font-black">{userStats?.completedStages || 0}</div>
                        <div className="text-xs text-orange-100 font-bold">完成关卡</div>
                    </div>
                </div>
            </div>

            {/* Share Button (Absolute) */}
            <button className="absolute top-6 right-6 p-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-white transition-colors">
                <Share2 className="w-5 h-5" />
            </button>
        </div>
    );
};
