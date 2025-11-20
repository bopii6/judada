import { useEffect, useMemo, useRef, useState } from "react";
import { Play, RefreshCw, Music, CheckCircle2, XCircle, ArrowRight, Pause } from "lucide-react";
import classNames from "classnames";
import { SONGS } from "../../data/songs";
import { useSoundEffects } from "../../hooks/useSoundEffects";

type GameState = "idle" | "playing" | "waiting" | "completed";

interface WordSlot {
    id: string;
    core: string;
    suffix: string;
    length: number;
    prefill: string;
    fillableLength: number;
}

const sanitizeLetters = (value: string) => value.replace(/[^A-Za-z']/g, "");

const buildWordSlots = (text: string): WordSlot[] => {
    if (!text.trim()) return [];

    const tokens = text.split(/\s+/).filter(Boolean);
    const slots: WordSlot[] = tokens.map((token, index) => {
        const match = token.match(/^([A-Za-z']+)(.*)$/);
        const core = match ? match[1] : token;
        const suffix = match ? match[2] : "";

        return {
            id: `${index}-${token}`,
            core,
            suffix,
            length: core.length,
            prefill: "", // No prefill in input value
            fillableLength: core.length
        };
    });

    // Add hint metadata (first letter) for longer words
    const candidateIndexes = slots
        .map((slot, idx) => ({ slot, idx }))
        .filter(({ slot }) => slot.length >= 4) // Lower threshold slightly
        .sort((a, b) => b.slot.length - a.slot.length)
        .slice(0, 3) // More hints
        .map(entry => entry.idx);

    candidateIndexes.forEach(index => {
        const slot = slots[index];
        if (slot) {
            slot.prefill = slot.core.charAt(0).toLowerCase(); // Store hint char
        }
    });

    return slots;
};

const assembleWordInputs = (slots: WordSlot[], inputs: string[]) =>
    slots
        .map((slot, index) => {
            if (!slot.length) return slot.core;
            const typedPart = (inputs[index] ?? "").trim();
            // Combined is just the typed part now, as user types full word
            const combined = typedPart;
            if (!combined.trim()) return "";
            return slot.suffix ? `${combined}${slot.suffix}` : combined;
        })
        .filter(Boolean)
        .join(" ");

export const MusicDemoPage = () => {
    const song = SONGS[0];
    const { playClick, playSuccess, playError, playPop } = useSoundEffects();

    const [gameState, setGameState] = useState<GameState>("idle");
    const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
    const [wordInputs, setWordInputs] = useState<string[]>([]);
    const [wordErrors, setWordErrors] = useState<Record<number, boolean>>({});
    const [feedback, setFeedback] = useState<{ type: "correct" | "incorrect" | null; message?: string }>({ type: null });

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const blockRefs = useRef<Array<HTMLInputElement | null>>([]);

    const currentPhrase = song.phrases[currentPhraseIndex];
    const isLastPhrase = currentPhraseIndex === song.phrases.length - 1;
    // Allow input while playing or waiting, lock only if correct
    const isInputLocked = feedback.type === "correct";
    const phraseText = currentPhrase?.en ?? "";
    const wordSlots = useMemo(() => buildWordSlots(phraseText), [phraseText]);

    useEffect(() => {
        setWordInputs(wordSlots.map(() => ""));
        setWordErrors({});
        blockRefs.current = [];
        // Auto-focus the first input when a new phrase loads
        setTimeout(() => focusFirstWritableBlock(), 100);
    }, [wordSlots]);

    const focusBlock = (index: number) => {
        if (index < 0 || index >= wordSlots.length) return;
        if (wordSlots[index]?.fillableLength === 0) return;
        const input = blockRefs.current[index];
        if (input) {
            const position = input.value.length;
            input.focus();
            input.setSelectionRange(position, position);
        }
    };

    const focusFirstWritableBlock = () => {
        for (let i = 0; i < wordSlots.length; i += 1) {
            if (wordSlots[i]?.fillableLength > 0) {
                focusBlock(i);
                break;
            }
        }
    };

    const focusNextBlock = (currentIndex: number) => {
        for (let i = currentIndex + 1; i < wordSlots.length; i += 1) {
            if (wordSlots[i]?.fillableLength > 0) {
                focusBlock(i);
                break;
            }
        }
    };

    const playPhraseAtIndex = (phraseIndex: number) => {
        if (!audioRef.current || !song.phrases[phraseIndex]) return;

        playClick();
        audioRef.current.currentTime = song.phrases[phraseIndex].start / 1000;
        audioRef.current.play().catch(console.error);
        setGameState("playing");
        setFeedback({ type: null });
    };

    const playPhrase = () => {
        playPhraseAtIndex(currentPhraseIndex);
    };

    const handleTimeUpdate = () => {
        if (!audioRef.current || !currentPhrase || gameState !== "playing") return;

        const currentTime = audioRef.current.currentTime * 1000;

        if (currentTime >= currentPhrase.end) {
            audioRef.current.pause();
            setGameState("waiting");
            // Removed focusFirstWritableBlock() to preserve user's current cursor position
        }
    };

    const normalizeText = (text: string) => text.toLowerCase().replace(/[.,!?]/g, "").trim();

    const checkAnswer = () => {
        if (!currentPhrase || !wordSlots.length) return;

        const typedSentence = assembleWordInputs(wordSlots, wordInputs);
        const normalized = normalizeText(typedSentence);
        const expected = normalizeText(currentPhrase.en);

        if (normalized === expected) {
            playSuccess();
            setFeedback({ type: "correct", message: "Perfect!" });

            setTimeout(() => {
                if (isLastPhrase) {
                    setGameState("completed");
                } else {
                    const nextIndex = currentPhraseIndex + 1;
                    setCurrentPhraseIndex(nextIndex);
                    setWordInputs([]);
                    setFeedback({ type: null });
                    setTimeout(() => playPhraseAtIndex(nextIndex), 50);
                }
            }, 1000);
        } else {
            playError();
            setFeedback({ type: "incorrect", message: "Not quite. Listen again." });
        }
    };

    const handleWordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Enter" && !isInputLocked) {
            checkAnswer();
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            focusBlock(index - 1);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            focusBlock(index + 1);
        } else if (e.key === "Backspace" && !wordInputs[index]) {
            // If empty and backspace, move to previous
            e.preventDefault();
            focusBlock(index - 1);
        }
    };

    const handleWordInputChange = (index: number, rawValue: string) => {
        const slot = wordSlots[index];
        if (!slot) return;
        if (slot.fillableLength === 0) return;

        const sanitized = sanitizeLetters(rawValue)
            .slice(0, slot.fillableLength || undefined)
            .toLowerCase(); // Lowercase input

        if (sanitized !== wordInputs[index]) {
            playPop();
        }

        setWordInputs(prev => {
            const next = [...prev];
            next[index] = sanitized;
            return next;
        });

        // Clear error when user types
        if (wordErrors[index]) {
            setWordErrors(prev => {
                const next = { ...prev };
                delete next[index];
                return next;
            });
        }

        if (slot.fillableLength && sanitized.length >= slot.fillableLength) {
            // Immediate validation
            const fullWord = sanitized.toLowerCase();
            const expected = slot.core.toLowerCase();

            if (fullWord !== expected) {
                // Error state
                playError();
                setWordErrors(prev => ({ ...prev, [index]: true }));
            } else {
                // Correct, move next
                focusNextBlock(index);
            }
        }
    };

    const resetGame = () => {
        playClick();
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        setGameState("idle");
        setCurrentPhraseIndex(0);
        setWordInputs([]);
        setWordErrors({});
        setFeedback({ type: null });
    };

    const requiredWordCount = wordSlots.filter(slot => slot.fillableLength > 0).length;
    const completedWordCount = wordSlots.filter(
        (slot, index) => slot.fillableLength === 0 || (wordInputs[index]?.length ?? 0) === slot.fillableLength
    ).length;
    const isSubmitDisabled = isInputLocked || !requiredWordCount || completedWordCount !== requiredWordCount;

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-[#FDFBF9] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Ambient Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-100/40 blur-[120px] mix-blend-multiply animate-pulse" />
                <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-100/40 blur-[120px] mix-blend-multiply animate-pulse delay-1000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[60%] rounded-full bg-pink-100/40 blur-[120px] mix-blend-multiply animate-pulse delay-2000" />
            </div>

            <audio
                ref={audioRef}
                src={song.audioUrl}
                onTimeUpdate={handleTimeUpdate}
                className="hidden"
            />

            <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-8">
                {/* Header */}
                <header className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100 text-slate-900">
                            <Music className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 leading-tight">{song.title}</h1>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{song.artist}</p>
                        </div>
                    </div>
                    <button
                        onClick={resetGame}
                        className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        title="Restart"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </header>

                {/* Main Game Area */}
                <main className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto">
                    {gameState === "completed" ? (
                        <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mb-4">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Lesson Complete!</h2>
                            <p className="text-lg text-slate-600 max-w-md mx-auto">
                                You've successfully transcribed all the clips. Great ear!
                            </p>
                            <button
                                onClick={resetGame}
                                className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-900 px-8 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-xl shadow-slate-900/20 transition-transform hover:scale-105 active:scale-95"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Play Again
                            </button>
                        </div>
                    ) : (
                        <div className="w-full flex flex-col gap-12">
                            {/* Progress Indicator */}
                            <div className="flex items-center justify-between px-2">
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                                    Phrase {currentPhraseIndex + 1} / {song.phrases.length}
                                </span>
                                <div className="flex gap-1">
                                    {song.phrases.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={classNames(
                                                "h-1.5 w-6 rounded-full transition-colors duration-300",
                                                idx === currentPhraseIndex ? "bg-indigo-500" : idx < currentPhraseIndex ? "bg-indigo-200" : "bg-slate-200"
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Lyric Display Card */}
                            <div className="relative group">
                                <div className="absolute -inset-4 bg-white/50 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 md:p-12 text-center transition-transform duration-300 hover:scale-[1.01]">

                                    {/* Play Button */}
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                                        <button
                                            onClick={playPhrase}
                                            disabled={gameState === "playing"}
                                            className={classNames(
                                                "flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-indigo-500/30 transition-all duration-300",
                                                gameState === "playing"
                                                    ? "bg-white text-indigo-500 scale-95 ring-4 ring-indigo-100"
                                                    : "bg-indigo-600 text-white hover:scale-110 hover:bg-indigo-700"
                                            )}
                                        >
                                            {gameState === "playing" ? (
                                                <span className="flex gap-1">
                                                    <span className="w-1 h-4 bg-current rounded-full animate-[bounce_1s_infinite]" />
                                                    <span className="w-1 h-4 bg-current rounded-full animate-[bounce_1s_infinite_0.2s]" />
                                                    <span className="w-1 h-4 bg-current rounded-full animate-[bounce_1s_infinite_0.4s]" />
                                                </span>
                                            ) : (
                                                <Play className="w-6 h-6 ml-1" />
                                            )}
                                        </button>
                                    </div>

                                    <div className="mt-8 space-y-2">
                                        <h3 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
                                            {currentPhrase?.en}
                                        </h3>
                                        <p className="text-2xl text-indigo-600 font-bold mt-2">
                                            {currentPhrase?.zh}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Input Area */}
                            <div className="space-y-8">
                                <div className="flex flex-wrap justify-center gap-x-4 gap-y-5">
                                    {wordSlots.map((slot, index) => {
                                        const isActive = !isInputLocked && slot.fillableLength > 0 && wordInputs[index]?.length === slot.fillableLength;

                                        return (
                                            <div key={slot.id} className="flex flex-col items-center">
                                                <div className="flex items-end gap-1">
                                                    {/* No separate prefill display anymore */}

                                                    {/* Input */}
                                                    <div className={classNames(
                                                        "relative group/input",
                                                        wordErrors[index] && "lesson-animate-shake"
                                                    )}>
                                                        {/* Hint Overlay */}
                                                        {!wordInputs[index] && slot.prefill && (
                                                            <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold tracking-[0.2em] text-slate-300 pointer-events-none select-none opacity-40">
                                                                {slot.prefill}
                                                            </span>
                                                        )}

                                                        <input
                                                            ref={element => {
                                                                blockRefs.current[index] = element;
                                                            }}
                                                            value={wordInputs[index] ?? ""}
                                                            onChange={event => handleWordInputChange(index, event.target.value)}
                                                            onKeyDown={(e) => handleWordKeyDown(e, index)}
                                                            maxLength={slot.fillableLength || undefined}
                                                            disabled={isInputLocked || slot.fillableLength === 0}
                                                            style={{ width: `${Math.max(slot.fillableLength || slot.length || 1, 1.5) * 1.2}em` }}
                                                            className={classNames(
                                                                "bg-transparent text-3xl font-bold tracking-[0.2em] text-center outline-none transition-colors relative z-10",
                                                                slot.fillableLength === 0 ? "text-slate-300 cursor-default" :
                                                                    wordErrors[index] ? "text-rose-500" : "text-slate-900",
                                                                "placeholder-transparent"
                                                            )}
                                                        />
                                                        {/* Animated Underline */}
                                                        <div className={classNames(
                                                            "absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-300",
                                                            slot.fillableLength === 0
                                                                ? "bg-slate-200"
                                                                : wordErrors[index]
                                                                    ? "bg-rose-400 h-1"
                                                                    : "bg-slate-300 group-focus-within/input:bg-indigo-500 group-focus-within/input:h-1"
                                                        )} />
                                                    </div>

                                                    {/* Suffix */}
                                                    {slot.suffix && (
                                                        <span className="text-3xl font-bold text-slate-300 mb-1">{slot.suffix}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Feedback & Action */}
                                <div className="h-20 flex items-center justify-center">
                                    {feedback.type ? (
                                        <div className={classNames(
                                            "flex items-center gap-3 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-wider shadow-sm animate-in slide-in-from-bottom-2",
                                            feedback.type === "correct"
                                                ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                                : "bg-rose-100 text-rose-700 border border-rose-200"
                                        )}>
                                            {feedback.type === "correct" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                            {feedback.message}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={checkAnswer}
                                            disabled={isSubmitDisabled}
                                            className={classNames(
                                                "group flex items-center gap-2 px-8 py-4 rounded-full text-sm font-bold uppercase tracking-widest transition-all duration-300",
                                                isSubmitDisabled
                                                    ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                                                    : "bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:scale-105 hover:shadow-xl hover:bg-slate-800"
                                            )}
                                        >
                                            <span>Check Answer</span>
                                            <ArrowRight className={classNames(
                                                "w-4 h-4 transition-transform duration-300",
                                                !isSubmitDisabled && "group-hover:translate-x-1"
                                            )} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default MusicDemoPage;
