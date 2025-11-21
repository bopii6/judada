import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, RefreshCw, Music, CheckCircle2, XCircle, ArrowRight, ArrowLeft, Pause, Volume2, Keyboard, MousePointerClick } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import classNames from "classnames";
import type { MusicTrackDetail } from "@judada/shared";
import { SAMPLE_TRACK } from "../../data/songs";
import { fetchMusicTracks } from "../../api/music";
import { useSoundEffects } from "../../hooks/useSoundEffects";
import { MusicCover } from "../../components/MusicCover";
import { WordDetailSidebar } from "../../components/WordDetailSidebar";
import { fetchWordDefinition } from "../../api/dictionary";

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
    const { playClick, playSuccess, playError, playPop } = useSoundEffects();
    const { slug } = useParams();
    const navigate = useNavigate();

    const { data: publishedTracks = [], isLoading } = useQuery({
        queryKey: ["lab-music-tracks"],
        queryFn: fetchMusicTracks
    });

    const activeTrack = useMemo<MusicTrackDetail | null>(() => {
        if (!publishedTracks.length || !slug) return null;
        return publishedTracks.find(track => track.slug === slug) ?? null;
    }, [slug, publishedTracks]);

    useEffect(() => {
        if (!isLoading && publishedTracks.length > 0 && !activeTrack) {
            // If loaded but track not found, maybe redirect or show error?
        }
    }, [isLoading, publishedTracks, activeTrack]);

    const song = activeTrack ?? SAMPLE_TRACK;
    const usingSample = !activeTrack;

    const [gameState, setGameState] = useState<GameState>("idle");
    const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
    const [wordInputs, setWordInputs] = useState<string[]>([]);
    const [wordErrors, setWordErrors] = useState<Record<number, boolean>>({});
    const [feedback, setFeedback] = useState<{ type: "correct" | "incorrect" | null; message?: string }>({ type: null });

    const [isLoadingAudio, setIsLoadingAudio] = useState(false);

    // Interaction Mode
    const [interactionMode, setInteractionMode] = useState<"typing" | "wordBank">("typing");

    // Word Bank states
    const [wordBank, setWordBank] = useState<string[]>([]);
    const [usedBankIndices, setUsedBankIndices] = useState<Set<number>>(new Set());

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const blockRefs = useRef<Array<HTMLInputElement | null>>([]);

    // Sidebar State
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleWordClick = (word: string) => {
        const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");
        setSelectedWord(cleanWord);
        setIsSidebarOpen(true);

        // Optional: Pause audio when learning
        if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
            setGameState("waiting");
        }
    };

    // Fetch word definition dynamically
    const { data: wordDefinition, isLoading: isLoadingDefinition } = useQuery({
        queryKey: ["word-definition", selectedWord],
        queryFn: () => selectedWord ? fetchWordDefinition(selectedWord) : null,
        enabled: !!selectedWord && isSidebarOpen,
        retry: false,
        staleTime: 1000 * 60 * 60 // Cache for 1 hour
    });

    // Optimized audio ready check - doesn't force reload unless necessary
    const waitForAudioReady = useCallback(async (audio: HTMLAudioElement) => {
        if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            return;
        }

        return new Promise<void>((resolve) => {
            const onCanPlay = () => {
                audio.removeEventListener("canplay", onCanPlay);
                resolve();
            };
            audio.addEventListener("canplay", onCanPlay);
            // Only call load if we have no data at all and network state is idle/empty
            if (audio.networkState === HTMLMediaElement.NETWORK_EMPTY || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
                audio.load();
            }
        });
    }, []);

    useEffect(() => {
        setGameState("idle");
        setCurrentPhraseIndex(0);
        setWordInputs([]);
        setWordErrors({});
        setFeedback({ type: null });
        setIsLoadingAudio(false);
    }, [song.id]);


    const currentPhrase = song.phrases[currentPhraseIndex];
    const phraseCount = song.phrases.length;
    const displayPhraseIndex = phraseCount > 0 ? currentPhraseIndex + 1 : 0;
    const isLastPhrase = currentPhraseIndex === song.phrases.length - 1;
    // Allow input while playing or waiting, lock only if correct
    const isInputLocked = feedback.type === "correct";
    const phraseText = currentPhrase?.en ?? "";
    const wordSlots = useMemo(() => buildWordSlots(phraseText), [phraseText]);

    // Initialize word bank when phrase changes
    useEffect(() => {
        setWordInputs(wordSlots.map(() => ""));
        setWordErrors({});

        // Extract fillable words and shuffle them
        const fillableWords = wordSlots
            .filter(slot => slot.fillableLength > 0)
            .map(slot => slot.core);

        // Shuffle array
        const shuffled = [...fillableWords].sort(() => Math.random() - 0.5);
        setWordBank(shuffled);
        setUsedBankIndices(new Set());
    }, [wordSlots]);

    // Handle word bank click - fill first empty slot
    const handleBankWordClick = useCallback((bankIndex: number) => {
        if (usedBankIndices.has(bankIndex) || isInputLocked) return;

        const word = wordBank[bankIndex];

        // Find first empty fillable slot
        const emptySlotIndex = wordSlots.findIndex((slot, idx) =>
            slot.fillableLength > 0 && !wordInputs[idx]
        );

        if (emptySlotIndex === -1) return;

        // Fill the slot
        const newInputs = [...wordInputs];
        newInputs[emptySlotIndex] = word;
        setWordInputs(newInputs);

        // Mark bank word as used
        setUsedBankIndices(prev => new Set([...prev, bankIndex]));

        playClick();
    }, [wordBank, wordSlots, wordInputs, usedBankIndices, isInputLocked]);

    // Handle slot click - remove word and return to bank
    const handleSlotClick = useCallback((slotIndex: number) => {
        if (isInputLocked || !wordInputs[slotIndex]) return;

        const word = wordInputs[slotIndex];

        // Find the bank index for this word
        const bankIndex = wordBank.findIndex((w, idx) =>
            w === word && usedBankIndices.has(idx)
        );

        if (bankIndex === -1) return;

        // Clear the slot
        const newInputs = [...wordInputs];
        newInputs[slotIndex] = "";
        setWordInputs(newInputs);

        // Mark bank word as available
        setUsedBankIndices(prev => {
            const next = new Set(prev);
            next.delete(bankIndex);
            return next;
        });

        playClick();
    }, [wordInputs, wordBank, usedBankIndices, isInputLocked]);

    const playPhraseAtIndex = async (phraseIndex: number) => {
        const audio = audioRef.current;
        const targetPhrase = song.phrases[phraseIndex];
        if (!audio || !targetPhrase) return;

        try {
            setIsLoadingAudio(true);
            playClick();

            // Set time first, this might trigger buffering
            audio.currentTime = targetPhrase.start / 1000;

            await waitForAudioReady(audio);

            await audio.play();
            setGameState("playing");
            setFeedback({ type: null });
        } catch (err) {
            console.error("Playback failed:", err);
            // Optionally show error feedback
        } finally {
            setIsLoadingAudio(false);
        }
    };

    const playPhrase = () => {
        void playPhraseAtIndex(currentPhraseIndex);
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

    const normalizeText = (text: string) =>
        text
            .toLowerCase()
            .normalize("NFKD")
            .replace(/['"`“”‘’]/g, "")
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

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
                    setTimeout(() => {
                        void playPhraseAtIndex(nextIndex);
                    }, 50);
                }
            }, 1000);
        } else {
            playError();
            setFeedback({ type: "incorrect", message: "Not quite. Listen again." });
        }
    };


    // Typing Mode Logic
    const focusBlock = useCallback((index: number) => {
        if (index < 0 || index >= wordSlots.length) return;
        if (wordSlots[index]?.fillableLength === 0) return;
        const input = blockRefs.current[index];
        if (input) {
            const position = input.value.length;
            input.focus();
            input.setSelectionRange(position, position);
        }
    }, [wordSlots]);

    const focusFirstWritableBlock = useCallback(() => {
        for (let i = 0; i < wordSlots.length; i += 1) {
            if (wordSlots[i]?.fillableLength > 0) {
                focusBlock(i);
                break;
            }
        }
    }, [focusBlock, wordSlots]);

    const focusNextBlock = useCallback((currentIndex: number) => {
        for (let i = currentIndex + 1; i < wordSlots.length; i += 1) {
            if (wordSlots[i]?.fillableLength > 0) {
                focusBlock(i);
                break;
            }
        }
    }, [focusBlock, wordSlots]);

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

    // Auto-focus when switching to typing mode
    useEffect(() => {
        if (interactionMode === "typing" && !isInputLocked) {
            const timer = window.setTimeout(() => focusFirstWritableBlock(), 100);
            return () => window.clearTimeout(timer);
        }
    }, [interactionMode, isInputLocked, focusFirstWritableBlock]);

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
        <div className="min-h-screen w-full bg-[#F8F9FA] text-slate-900 font-sans selection:bg-indigo-500/20 selection:text-indigo-900 overflow-hidden">
            {/* Sidebar */}
            <WordDetailSidebar
                word={selectedWord}
                definition={wordDefinition || null}
                isOpen={isSidebarOpen}
                isLoading={isLoadingDefinition}
                onClose={() => setIsSidebarOpen(false)}
            />

            {/* Main Content Overlay when Sidebar is open (Mobile) */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40 sm:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
            {/* Ambient Background - Restored Light Theme */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-100/40 blur-[120px] mix-blend-multiply animate-pulse" />
                <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-100/40 blur-[120px] mix-blend-multiply animate-pulse delay-1000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[60%] rounded-full bg-pink-100/40 blur-[120px] mix-blend-multiply animate-pulse delay-2000" />
                {/* Subtle Noise */}
                <div className="absolute inset-0 opacity-[0.02] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
            </div>

            <audio
                ref={audioRef}
                src={song.audioUrl ?? ""}
                preload="auto"
                onTimeUpdate={handleTimeUpdate}
                className="hidden"
            />

            <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
                {/* Header */}
                <header className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate("/lab/music")}
                            className="group flex items-center justify-center w-12 h-12 rounded-full bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                        </button>

                        <div className="flex items-center gap-4">
                            <MusicCover
                                url={song.coverUrl}
                                title={song.title}
                                size="sm"
                                className="shadow-md shadow-indigo-100"
                            />
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 leading-tight">{song.title}</h1>
                                <p className="text-sm font-medium text-slate-500">{song.artist ?? "Unknown Artist"}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Mode Toggle */}
                        <div className="bg-slate-100 p-1 rounded-full flex items-center border border-slate-200 mr-2">
                            <button
                                onClick={() => {
                                    setInteractionMode("wordBank");
                                    playClick();
                                    setWordInputs(wordSlots.map(() => ""));
                                }}
                                className={classNames(
                                    "flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
                                    interactionMode === "wordBank"
                                        ? "bg-white text-indigo-600 shadow-sm"
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                                title="Tap to Fill"
                            >
                                <MousePointerClick className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    setInteractionMode("typing");
                                    playClick();
                                    setWordInputs(wordSlots.map(() => ""));
                                }}
                                className={classNames(
                                    "flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
                                    interactionMode === "typing"
                                        ? "bg-white text-indigo-600 shadow-sm"
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                                title="Type"
                            >
                                <Keyboard className="w-4 h-4" />
                            </button>
                        </div>

                        <button
                            onClick={resetGame}
                            className="p-3 rounded-full text-slate-400 hover:bg-white hover:shadow-sm hover:text-slate-600 transition-all"
                            title="Restart"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Main Game Area */}
                <main className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl mx-auto">
                    {gameState === "completed" ? (
                        <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
                            <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-100 text-emerald-600 mb-4 shadow-lg shadow-emerald-100">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-5xl font-black text-slate-900 tracking-tight">Lesson Complete!</h2>
                                <p className="text-xl text-slate-600 max-w-md mx-auto">
                                    You&apos;ve successfully transcribed all the clips. Great ear!
                                </p>
                            </div>
                            <button
                                onClick={resetGame}
                                className="mt-8 inline-flex items-center gap-3 rounded-full bg-slate-900 text-white px-10 py-5 text-sm font-bold uppercase tracking-widest shadow-xl shadow-slate-900/20 transition-transform hover:scale-105 active:scale-95"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Play Again
                            </button>
                        </div>
                    ) : (
                        <div className="w-full flex flex-col gap-16">
                            {/* Progress & Visualizer */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                                    <span>Phrase {displayPhraseIndex} / {phraseCount}</span>
                                    <span>{Math.round((currentPhraseIndex / phraseCount) * 100)}% Complete</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                                        style={{ width: `${((currentPhraseIndex) / phraseCount) * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Lyric Display Card */}
                            <div className="relative group perspective-1000">
                                <div className="absolute -inset-4 bg-white/50 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-white/60 p-10 md:p-16 text-center transition-transform duration-300 hover:scale-[1.01] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">

                                    {/* Play Button */}
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                                        <button
                                            onClick={playPhrase}
                                            disabled={gameState === "playing" || isLoadingAudio || !song.phrases.length}
                                            className={classNames(
                                                "flex h-16 w-16 items-center justify-center rounded-full shadow-xl shadow-indigo-500/20 transition-all duration-300 border border-white",
                                                gameState === "playing" || isLoadingAudio
                                                    ? "bg-white text-indigo-500 scale-95 ring-4 ring-indigo-50"
                                                    : "bg-indigo-600 text-white hover:scale-110 hover:bg-indigo-700"
                                            )}
                                        >
                                            {isLoadingAudio ? (
                                                <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            ) : gameState === "playing" ? (
                                                <span className="flex gap-1">
                                                    <span className="w-1.5 h-5 bg-current rounded-full animate-[bounce_1s_infinite]" />
                                                    <span className="w-1.5 h-5 bg-current rounded-full animate-[bounce_1s_infinite_0.2s]" />
                                                    <span className="w-1.5 h-5 bg-current rounded-full animate-[bounce_1s_infinite_0.4s]" />
                                                </span>
                                            ) : (
                                                <Play className="w-7 h-7 ml-1 fill-current" />
                                            )}
                                        </button>
                                    </div>

                                    <div className="mt-6 space-y-4">
                                        <h3 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight flex flex-wrap justify-center gap-x-3">
                                            {currentPhrase?.en.split(" ").map((word, i) => (
                                                <span
                                                    key={i}
                                                    onClick={() => handleWordClick(word)}
                                                    className="cursor-pointer hover:text-indigo-600 hover:scale-105 transition-all duration-200 active:scale-95"
                                                >
                                                    {word}
                                                </span>
                                            ))}
                                        </h3>
                                        {currentPhrase?.zh && (
                                            <p className="text-xl text-indigo-600 font-medium">
                                                {currentPhrase.zh}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>



                            {/* Input Area */}
                            <div className="space-y-8">
                                {/* Word Slots / Inputs */}
                                <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-4 px-8 min-h-[120px]">
                                    {wordSlots.map((slot, index) => {
                                        const hasInput = !!wordInputs[index];

                                        if (interactionMode === "typing") {
                                            return (
                                                <div key={slot.id} className="flex flex-col items-center">
                                                    <div className="flex items-end gap-0.5">
                                                        <div
                                                            onClick={() => wordInputs[index] && handleWordClick(wordInputs[index])}
                                                            className={classNames(
                                                                "relative group/input",
                                                                wordErrors[index] && "lesson-animate-shake",
                                                                wordInputs[index] && "cursor-pointer"
                                                            )}>
                                                            {/* Hint Overlay - Moved to left */}
                                                            {!wordInputs[index] && slot.prefill && (
                                                                <span className="absolute -left-3 bottom-1 text-lg font-bold text-slate-300 pointer-events-none select-none">
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
                                                                style={{ width: `${Math.max(slot.fillableLength || slot.length || 1, 1.5) * 0.7}em` }}
                                                                className={classNames(
                                                                    "bg-transparent text-3xl font-bold tracking-wide text-center outline-none transition-colors relative z-10",
                                                                    slot.fillableLength === 0 ? "text-slate-300 cursor-default" :
                                                                        wordErrors[index] ? "text-rose-500" : "text-slate-900",
                                                                    "placeholder-transparent"
                                                                )}
                                                            />
                                                            {/* Animated Underline */}
                                                            <div className={classNames(
                                                                "absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-300 rounded-full",
                                                                slot.fillableLength === 0
                                                                    ? "bg-slate-200"
                                                                    : wordErrors[index]
                                                                        ? "bg-rose-400 h-1"
                                                                        : "bg-slate-300 group-focus-within/input:bg-indigo-500 group-focus-within/input:h-1"
                                                            )} />
                                                        </div>

                                                        {/* Suffix */}
                                                        {slot.suffix && (
                                                            <span className="text-4xl font-bold text-slate-300 mb-1">{slot.suffix}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // Word Bank Mode
                                        return (
                                            <div key={slot.id} className="flex items-center gap-1">
                                                {slot.fillableLength > 0 ? (
                                                    <button
                                                        onClick={() => handleSlotClick(index)}
                                                        disabled={isInputLocked || !hasInput}
                                                        className={classNames(
                                                            "px-6 py-3 rounded-2xl text-2xl font-bold transition-all duration-300 border-2",
                                                            hasInput
                                                                ? "bg-indigo-500 text-white border-indigo-600 shadow-lg hover:scale-105 hover:shadow-xl active:scale-95"
                                                                : "bg-white border-dashed border-slate-300 text-slate-300 cursor-default"
                                                        )}
                                                    >
                                                        {hasInput ? wordInputs[index] : "___"}
                                                    </button>
                                                ) : (
                                                    <span className="text-2xl font-bold text-slate-400">{slot.core}</span>
                                                )}

                                                {/* Suffix */}
                                                {slot.suffix && (
                                                    <span className="text-2xl font-bold text-slate-400">{slot.suffix}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Word Bank - Only show in Word Bank mode */}
                                {interactionMode === "wordBank" && (
                                    <div className="px-8">
                                        <div className="flex flex-wrap items-center justify-center gap-3 p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 min-h-[100px]">
                                            {wordBank.map((word, bankIndex) => {
                                                const isUsed = usedBankIndices.has(bankIndex);

                                                return (
                                                    <button
                                                        key={`bank-${bankIndex}-${word}`}
                                                        onClick={() => handleBankWordClick(bankIndex)}
                                                        disabled={isUsed || isInputLocked}
                                                        className={classNames(
                                                            "px-6 py-3 rounded-2xl text-2xl font-bold transition-all duration-300 border-2",
                                                            isUsed
                                                                ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-40"
                                                                : "bg-white text-slate-700 border-slate-200 shadow-md hover:scale-110 hover:shadow-xl hover:border-indigo-300 hover:text-indigo-600 active:scale-95"
                                                        )}
                                                    >
                                                        {word}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Feedback & Action */}
                            <div className="h-24 flex items-center justify-center">
                                {feedback.type ? (
                                    <div className={classNames(
                                        "flex items-center gap-4 px-8 py-4 rounded-full text-base font-bold uppercase tracking-wider shadow-lg animate-in slide-in-from-bottom-4 border",
                                        feedback.type === "correct"
                                            ? "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100"
                                            : "bg-rose-50 text-rose-600 border-rose-100 shadow-rose-100"
                                    )}>
                                        {feedback.type === "correct" ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                                        {feedback.message}
                                    </div>
                                ) : (
                                    <button
                                        onClick={checkAnswer}
                                        disabled={isSubmitDisabled}
                                        className={classNames(
                                            "group flex items-center gap-3 px-10 py-5 rounded-full text-sm font-bold uppercase tracking-widest transition-all duration-300",
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
                    )}
                </main>
            </div>
        </div>
    );
};
