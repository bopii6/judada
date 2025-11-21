import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

export const Mascot = () => {
    const [isBlinking, setIsBlinking] = useState(false);
    const [isWaving, setIsWaving] = useState(false);

    // Blinking effect
    useEffect(() => {
        const blinkInterval = setInterval(() => {
            setIsBlinking(true);
            setTimeout(() => setIsBlinking(false), 200);
        }, 4000);
        return () => clearInterval(blinkInterval);
    }, []);

    // Random waving
    useEffect(() => {
        const waveInterval = setInterval(() => {
            setIsWaving(true);
            setTimeout(() => setIsWaving(false), 2000);
        }, 10000);
        return () => clearInterval(waveInterval);
    }, []);

    return (
        <div className="fixed bottom-8 right-8 z-40 hidden md:block pointer-events-none">
            <div className="relative w-32 h-32">
                {/* Speech Bubble */}
                <div className="absolute -top-16 -left-20 bg-white px-4 py-2 rounded-2xl rounded-br-none shadow-lg border-2 border-indigo-100 animate-bounce duration-[3000ms]">
                    <p className="text-sm font-bold text-indigo-600 whitespace-nowrap">Ready to play? 🎵</p>
                </div>

                {/* Bear Body */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-20 bg-[#FFC75F] rounded-t-[3rem] shadow-xl">
                    {/* Belly */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-12 bg-[#FFE5B4] rounded-t-[2rem]" />
                </div>

                {/* Bear Head */}
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-28 h-24 bg-[#FFC75F] rounded-[2.5rem] shadow-lg">
                    {/* Ears */}
                    <div className="absolute -top-2 -left-2 w-10 h-10 bg-[#FFC75F] rounded-full" />
                    <div className="absolute -top-2 -right-2 w-10 h-10 bg-[#FFC75F] rounded-full" />

                    {/* Inner Ears */}
                    <div className="absolute top-0 left-0 w-6 h-6 bg-[#FFE5B4] rounded-full m-2" />
                    <div className="absolute top-0 right-0 w-6 h-6 bg-[#FFE5B4] rounded-full m-2" />

                    {/* Face */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/3 w-full h-full flex flex-col items-center justify-center">
                        {/* Eyes */}
                        <div className="flex gap-8 mb-1">
                            <div className={classNames("w-3 h-3 bg-slate-800 rounded-full transition-all duration-100", isBlinking ? "h-0.5 mt-1.5" : "")} />
                            <div className={classNames("w-3 h-3 bg-slate-800 rounded-full transition-all duration-100", isBlinking ? "h-0.5 mt-1.5" : "")} />
                        </div>

                        {/* Nose & Mouth */}
                        <div className="w-8 h-6 bg-white rounded-full flex flex-col items-center justify-center mt-1">
                            <div className="w-3 h-2 bg-slate-800 rounded-full mb-0.5" />
                            <div className="w-0.5 h-1.5 bg-slate-800" />
                            <div className="flex gap-0.5">
                                <div className="w-2 h-1 border-b-2 border-slate-800 rounded-full" />
                                <div className="w-2 h-1 border-b-2 border-slate-800 rounded-full" />
                            </div>
                        </div>

                        {/* Cheeks */}
                        <div className="absolute top-10 left-4 w-3 h-2 bg-rose-300/50 rounded-full blur-[1px]" />
                        <div className="absolute top-10 right-4 w-3 h-2 bg-rose-300/50 rounded-full blur-[1px]" />
                    </div>
                </div>

                {/* Arms */}
                <div className={classNames(
                    "absolute bottom-8 -right-2 w-8 h-8 bg-[#FFC75F] rounded-full origin-bottom-left transition-transform duration-500",
                    isWaving ? "animate-wave" : ""
                )} />
                <div className="absolute bottom-8 -left-2 w-8 h-8 bg-[#FFC75F] rounded-full" />
            </div>
        </div>
    );
};
