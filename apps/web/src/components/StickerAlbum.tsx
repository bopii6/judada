import React, { useState } from "react";
import classNames from "classnames";
import { Lock, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";

// Mock Data for Sticker Collections
const COLLECTIONS = [
    {
        id: "animals",
        name: "森林伙伴",
        theme: "bg-green-100",
        stickers: [
            { id: "lion", emoji: "🦁", name: "狮子莱昂", rarity: "rare", collected: true },
            { id: "elephant", emoji: "🐘", name: "大象特朗基", rarity: "common", collected: true },
            { id: "panda", emoji: "🐼", name: "熊猫班班", rarity: "epic", collected: false },
            { id: "fox", emoji: "🦊", name: "狐狸斯威夫特", rarity: "common", collected: true },
            { id: "koala", emoji: "🐨", name: "考拉瞌睡虫", rarity: "common", collected: false },
            { id: "tiger", emoji: "🐯", name: "老虎条纹", rarity: "rare", collected: false },
            { id: "bear", emoji: "🐻", name: "小熊布朗尼", rarity: "common", collected: true },
            { id: "rabbit", emoji: "🐰", name: "兔子跳跳", rarity: "common", collected: true },
        ]
    },
    {
        id: "ocean",
        name: "海洋探险家",
        theme: "bg-blue-100",
        stickers: [
            { id: "whale", emoji: "🐋", name: "蓝鲸大蓝", rarity: "epic", collected: false },
            { id: "dolphin", emoji: "🐬", name: "海豚飞飞", rarity: "rare", collected: false },
            { id: "octopus", emoji: "🐙", name: "章鱼墨墨", rarity: "common", collected: false },
            { id: "fish", emoji: "🐠", name: "金鱼小金", rarity: "common", collected: false },
        ]
    }
];

export const StickerAlbum: React.FC = () => {
    const [currentCollectionIdx, setCurrentCollectionIdx] = useState(0);
    const collection = COLLECTIONS[currentCollectionIdx];

    const nextCollection = () => {
        if (currentCollectionIdx < COLLECTIONS.length - 1) {
            setCurrentCollectionIdx(prev => prev + 1);
        }
    };

    const prevCollection = () => {
        if (currentCollectionIdx > 0) {
            setCurrentCollectionIdx(prev => prev - 1);
        }
    };

    const collectedCount = collection.stickers.filter(s => s.collected).length;
    const totalCount = collection.stickers.length;
    const progress = (collectedCount / totalCount) * 100;

    return (
        <div className="bg-white rounded-[3rem] shadow-xl border-4 border-slate-100 overflow-hidden relative">
            {/* Book Binding Effect */}
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-slate-100 border-r border-slate-200 z-10 flex flex-col justify-center gap-2">
                {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-4 w-full bg-slate-300 rounded-r-md shadow-inner" />
                ))}
            </div>

            {/* Header / Navigation */}
            <div className="pl-12 pr-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={prevCollection}
                        disabled={currentCollectionIdx === 0}
                        className="p-2 rounded-full hover:bg-white disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6 text-slate-400" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">{collection.name}</h2>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                            <span>第一季</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="text-bubblegum">已收集 {collectedCount}/{totalCount}</span>
                        </div>
                    </div>
                    <button
                        onClick={nextCollection}
                        disabled={currentCollectionIdx === COLLECTIONS.length - 1}
                        className="p-2 rounded-full hover:bg-white disabled:opacity-30 transition-colors"
                    >
                        <ChevronRight className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="w-32">
                    <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-bubblegum transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Sticker Grid */}
            <div className={classNames("pl-12 pr-8 py-8 min-h-[400px] grid grid-cols-2 sm:grid-cols-4 gap-6", collection.theme)}>
                {collection.stickers.map((sticker) => (
                    <div key={sticker.id} className="relative group aspect-[4/5]">
                        {/* Sticker Placeholder / Slot */}
                        <div className="absolute inset-0 bg-black/5 rounded-2xl border-2 border-dashed border-black/10" />

                        {sticker.collected ? (
                            // Collected Sticker
                            <div className="absolute inset-0 flex flex-col items-center justify-center transform transition-transform duration-300 hover:scale-110 hover:rotate-3 cursor-pointer z-10">
                                <div className="relative">
                                    {/* White Border / Die-cut effect */}
                                    <div className="text-[5rem] filter drop-shadow-xl select-none">
                                        {sticker.emoji}
                                    </div>
                                    {/* Shiny Effect for Rares */}
                                    {sticker.rarity !== 'common' && (
                                        <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-pulse" />
                                    )}
                                </div>
                                <div className="mt-2 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-black text-slate-700 shadow-sm">
                                    {sticker.name}
                                </div>
                            </div>
                        ) : (
                            // Locked / Silhouette
                            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
                                <div className="text-[5rem] filter grayscale blur-sm select-none opacity-20">
                                    {sticker.emoji}
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Lock className="w-8 h-8 text-slate-400" />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
