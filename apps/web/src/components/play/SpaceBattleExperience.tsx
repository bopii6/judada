import React, { useEffect, useRef, useState, useCallback } from "react";
import { Rocket, Zap, Crosshair, Target } from "lucide-react";
import { CourseStage } from "../../api/courses";
import classNames from "classnames";
import { useSoundEffects } from "../../hooks/useSoundEffects";
import { useScreenShake } from "../../hooks/useScreenShake";

interface SpaceBattleExperienceProps {
    stage: CourseStage;
    index: number;
    total: number;
    onSuccess: () => void;
    onMistake: () => void;
}

interface GameTarget {
    id: string;
    word: string;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    speed: number;
    isDestroyed: boolean;
    matchedIndex: number; // How many characters have been matched
}

interface Explosion {
    id: number;
    x: number;
    y: number;
}

export const SpaceBattleExperience: React.FC<SpaceBattleExperienceProps> = ({
    stage,
    onSuccess,
    onMistake,
}) => {
    const [targets, setTargets] = useState<GameTarget[]>([]);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [showLevelComplete, setShowLevelComplete] = useState(false);
    const [gameActive, setGameActive] = useState(false);
    const [currentTargetId, setCurrentTargetId] = useState<string | null>(null);
    const [laserBeams, setLaserBeams] = useState<{ id: number; x: number; y: number; targetX: number; targetY: number }[]>([]);
    const [explosions, setExplosions] = useState<Explosion[]>([]);

    const containerRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number>();
    const lastTimeRef = useRef<number>();

    const { playLaser, playExplosion, playSuccess, playError } = useSoundEffects();
    const { shakeClass, triggerShake } = useScreenShake();

    // Initialize game
    useEffect(() => {
        if (!stage.promptEn) return;

        // Split sentence into words and create targets
        const words = stage.promptEn.split(" ").filter(w => w.length > 0);
        const newTargets: GameTarget[] = words.map((word, i) => ({
            id: `target-${i}`,
            word: word.replace(/[^a-zA-Z0-9]/g, ""), // Simple cleanup
            x: 10 + Math.random() * 80, // Random X position 10-90%
            y: -20 - (i * 30), // Staggered start positions above screen
            speed: 0.05 + Math.random() * 0.05, // Random speed
            isDestroyed: false,
            matchedIndex: 0,
        }));

        setTargets(newTargets);
        setScore(0);
        setCombo(0);
        setCurrentTargetId(null);

        // Start with countdown
        setCountdown(3);
        setGameActive(false);

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [stage]);

    // Countdown Timer
    useEffect(() => {
        if (countdown === null) return;

        if (countdown === 0) {
            setGameActive(true);
            setCountdown(null);
            return;
        }

        const timer = setTimeout(() => {
            setCountdown(prev => (prev !== null ? prev - 1 : null));
        }, 1000);

        return () => clearTimeout(timer);
    }, [countdown]);

    // Game Loop
    const updateGame = useCallback((time: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = time;
        const deltaTime = time - lastTimeRef.current;
        lastTimeRef.current = time;

        setTargets(prevTargets => {
            const activeTargets = prevTargets.filter(t => !t.isDestroyed);

            // Check win condition
            if (activeTargets.length === 0 && prevTargets.length > 0) {
                setGameActive(false);
                playSuccess();
                setShowLevelComplete(true);
                return prevTargets;
            }

            return prevTargets.map(target => {
                if (target.isDestroyed) return target;

                let newY = target.y + target.speed * (deltaTime / 16);

                // Reset if it goes off screen (looping for endless feel until destroyed)
                if (newY > 120) {
                    newY = -20;
                    // Maybe penalize? For now just loop
                }

                return { ...target, y: newY };
            });
        });

        // Clean up lasers
        setLaserBeams(prev => prev.filter(beam => Date.now() - beam.id < 200));

        // Clean up explosions
        setExplosions(prev => prev.filter(exp => Date.now() - exp.id < 500));

        if (gameActive) {
            requestRef.current = requestAnimationFrame(updateGame);
        }
    }, [gameActive, onSuccess, playSuccess]);

    useEffect(() => {
        if (gameActive) {
            requestRef.current = requestAnimationFrame(updateGame);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [gameActive, updateGame]);

    // Handle Typing
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!gameActive) return;

            const key = e.key.toLowerCase();
            if (!/^[a-z0-9]$/.test(key)) return;

            setTargets(prevTargets => {
                let newTargets = [...prevTargets];
                let hit = false;
                let targetIdToUpdate = currentTargetId;

                // If no current target, find one that starts with the key
                if (!targetIdToUpdate) {
                    // Find the lowest target that matches the key to prioritize close threats
                    const potentialTargets = newTargets
                        .filter(t => !t.isDestroyed && t.y > -10 && t.word.toLowerCase().startsWith(key))
                        .sort((a, b) => b.y - a.y);

                    if (potentialTargets.length > 0) {
                        targetIdToUpdate = potentialTargets[0].id;
                        setCurrentTargetId(targetIdToUpdate);
                    }
                }

                if (targetIdToUpdate) {
                    const targetIndex = newTargets.findIndex(t => t.id === targetIdToUpdate);
                    if (targetIndex !== -1) {
                        const target = newTargets[targetIndex];
                        const expectedChar = target.word[target.matchedIndex].toLowerCase();

                        if (key === expectedChar) {
                            hit = true;
                            const newMatchedIndex = target.matchedIndex + 1;

                            playLaser();

                            // Shoot laser
                            const laserId = Date.now();
                            setLaserBeams(prev => [...prev, {
                                id: laserId,
                                x: 50, // Player center
                                y: 90, // Player bottom
                                targetX: target.x,
                                targetY: target.y
                            }]);

                            if (newMatchedIndex >= target.word.length) {
                                // Destroyed
                                newTargets[targetIndex] = { ...target, matchedIndex: newMatchedIndex, isDestroyed: true };
                                setCurrentTargetId(null);
                                setScore(s => s + 100 + (combo * 10)); // Bonus for combo
                                setCombo(c => c + 1);
                                playExplosion();
                                triggerShake();

                                // Add explosion effect
                                setExplosions(prev => [...prev, {
                                    id: Date.now(),
                                    x: target.x,
                                    y: target.y
                                }]);
                            } else {
                                // Progress
                                newTargets[targetIndex] = { ...target, matchedIndex: newMatchedIndex };
                            }
                        } else {
                            // Mistake on current target
                            playError();
                            onMistake();
                            setCombo(0);
                        }
                    }
                } else {
                    // Mistake (typing but no matching start word)
                    playError();
                    onMistake();
                    setCombo(0);
                }

                return newTargets;
            });
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [gameActive, currentTargetId, onMistake, playLaser, playExplosion, playError, combo, triggerShake]);


    return (
        <div
            ref={containerRef}
            className={classNames(
                "relative w-full h-[600px] bg-slate-900 rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl",
                shakeClass
            )}
            style={{
                backgroundImage: "radial-gradient(circle at 50% 100%, #1e293b 0%, #0f172a 100%)"
            }}
        >
            {/* Stars Background - Parallax Layers */}
            <div className="absolute inset-0 opacity-50">
                {[...Array(50)].map((_, i) => (
                    <div
                        key={`star-1-${i}`}
                        className="absolute bg-white rounded-full animate-pulse"
                        style={{
                            width: Math.random() * 2 + 'px',
                            height: Math.random() * 2 + 'px',
                            top: Math.random() * 100 + '%',
                            left: Math.random() * 100 + '%',
                            animationDuration: Math.random() * 3 + 2 + 's',
                            opacity: Math.random() * 0.5 + 0.3
                        }}
                    />
                ))}
            </div>
            <div className="absolute inset-0 opacity-30">
                {[...Array(30)].map((_, i) => (
                    <div
                        key={`star-2-${i}`}
                        className="absolute bg-blue-200 rounded-full"
                        style={{
                            width: Math.random() * 3 + 1 + 'px',
                            height: Math.random() * 3 + 1 + 'px',
                            top: Math.random() * 100 + '%',
                            left: Math.random() * 100 + '%',
                            animationDuration: Math.random() * 5 + 5 + 's'
                        }}
                    />
                ))}
            </div>

            {/* HUD */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20 text-white font-mono">
                <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-red-400" />
                    <span>SCORE: {score.toString().padStart(6, '0')}</span>
                </div>
                <div className="flex items-center gap-4">
                    {combo > 1 && (
                        <div className="text-yellow-400 font-bold animate-pulse">
                            {combo}x COMBO
                        </div>
                    )}
                    <div className="text-xs text-slate-400">TYPE TO SHOOT</div>
                </div>
            </div>

            {/* Countdown Overlay */}
            {countdown !== null && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="text-9xl font-black text-white animate-bounce">
                        {countdown === 0 ? "GO!" : countdown}
                    </div>
                </div>
            )}

            {/* Level Complete Overlay */}
            {showLevelComplete && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
                    <h2 className="text-5xl font-bold text-white mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                        MISSION ACCOMPLISHED
                    </h2>
                    <div className="text-2xl text-slate-300 mb-8 font-mono">
                        FINAL SCORE: <span className="text-white">{score}</span>
                    </div>
                    <button
                        onClick={onSuccess}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-indigo-500/50"
                    >
                        CONTINUE
                    </button>
                </div>
            )}

            {/* Targets */}
            {targets.map(target => (
                !target.isDestroyed && (
                    <div
                        key={target.id}
                        className={classNames(
                            "absolute transform -translate-x-1/2 transition-transform duration-100",
                            currentTargetId === target.id ? "z-10 scale-110" : "z-0"
                        )}
                        style={{
                            left: `${target.x}%`,
                            top: `${target.y}%`,
                        }}
                    >
                        <div className={classNames(
                            "flex flex-col items-center",
                            currentTargetId === target.id ? "opacity-100" : "opacity-80"
                        )}>
                            {/* Alien/Asteroid Graphic */}
                            <div className={classNames(
                                "w-12 h-12 mb-2 rounded-full flex items-center justify-center shadow-lg transition-all",
                                currentTargetId === target.id ? "bg-red-500 shadow-red-500/50" : "bg-indigo-600 shadow-indigo-500/30"
                            )}>
                                <div className="text-2xl">👾</div>
                            </div>

                            {/* Word Label */}
                            <div className="bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10 flex font-mono text-lg font-bold tracking-wider">
                                <span className="text-green-400">{target.word.substring(0, target.matchedIndex)}</span>
                                <span className="text-white">{target.word.substring(target.matchedIndex)}</span>
                            </div>

                            {/* Target Indicator */}
                            {currentTargetId === target.id && (
                                <Crosshair className="absolute -top-6 w-6 h-6 text-red-400 animate-spin-slow" />
                            )}
                        </div>
                    </div>
                )
            ))}

            {/* Explosions */}
            {explosions.map(exp => (
                <div
                    key={exp.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
                    style={{ left: `${exp.x}%`, top: `${exp.y}%` }}
                >
                    <div className="relative">
                        <div className="absolute w-20 h-20 bg-orange-500 rounded-full blur-xl opacity-50 animate-ping" />
                        <div className="absolute w-12 h-12 bg-yellow-300 rounded-full blur-md animate-ping" style={{ animationDelay: '0.1s' }} />
                        <div className="text-4xl animate-bounce">💥</div>
                    </div>
                </div>
            ))}

            {/* Player Ship */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
                <div className="relative">
                    <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center border-2 border-slate-600 shadow-xl transform rotate-45">
                        <Rocket className="w-10 h-10 text-sky-400 transform -rotate-45" />
                    </div>
                    {/* Engine Flame */}
                    <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-4 h-8 bg-orange-500 blur-md animate-pulse" />
                </div>
            </div>

            {/* Lasers */}
            {laserBeams.map(beam => (
                <div
                    key={beam.id}
                    className="absolute w-1 bg-green-400 shadow-[0_0_8px_#4ade80] rounded-full z-10"
                    style={{
                        left: `${beam.x}%`,
                        top: `${beam.y}%`,
                        height: '100%', // Simplified beam for now
                        transformOrigin: 'bottom center',
                        transform: `rotate(${Math.atan2(beam.targetX - beam.x, -(beam.targetY - beam.y)) * (180 / Math.PI)}deg) scaleY(1)`,
                        opacity: (Date.now() - beam.id) < 100 ? 1 : 0,
                        transition: 'opacity 0.1s ease-out'
                    }}
                />
            ))}
        </div>
    );
};
