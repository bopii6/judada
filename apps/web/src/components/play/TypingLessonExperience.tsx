import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import type { CourseStage } from "../../api/courses";
import { speak } from "../../hooks/useTTS";
import { useFeedbackSound } from "../../hooks/useFeedbackSoundHook";
import { Volume2, Trash2, ArrowRight, CheckCircle2, XCircle } from "lucide-react";

export interface TypingLessonExperienceProps {
  stage: CourseStage;
  index?: number;
  total?: number;
  onSuccess: () => void;
  onMistake: () => void;
  variant?: "typing" | "dictation";
  helpLevel?: 0 | 1 | 2;
}

interface WordSlot {
  id: string;
  core: string;
  suffix: string;
  length: number;
  prefill: string;
  fillableLength: number;
}

// Only allow letters and digits for user input - symbols are auto-inserted
const sanitizeLetters = (value: string) => value.replace(/[^A-Za-z0-9]/g, "");

// Insert symbols (apostrophes, colons) at correct positions based on the expected core
const autoInsertSymbols = (input: string, core: string): string => {
  let result = "";
  let inputIndex = 0;

  for (let i = 0; i < core.length && inputIndex <= input.length; i++) {
    const coreChar = core[i];
    // If this position in core is a symbol (apostrophe, colon, or decimal point)
    if (coreChar === "'" || coreChar === ":" || coreChar === ".") {
      result += coreChar;  // Auto-insert the symbol
    } else {
      // Take the next character from user input
      if (inputIndex < input.length) {
        result += input[inputIndex];
      }
      inputIndex++;
    }
  }

  return result;
};

// Extract only letters/digits from a string (for counting and comparison)
const extractLettersDigits = (str: string): string => str.replace(/[^A-Za-z0-9]/g, "");

const assembleWordInputs = (slots: WordSlot[], inputs: string[]): string =>
  slots
    .map((slot, index) => {
      if (!slot.fillableLength) return slot.core;
      const typedPart = (inputs[index] ?? "").trim();
      if (!typedPart) return "";
      // Input already has symbols auto-inserted
      return slot.suffix ? `${typedPart}${slot.suffix}` : typedPart;
    })
    .filter(Boolean)
    .join(" ");

const normalizeForCompare = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[""'']/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const getSlotWidthCh = (slot: WordSlot) => {
  const base = slot.fillableLength || slot.length || 1;
  return Math.min(Math.max(base, 2.5), 10);
};

export const TypingLessonExperience = ({
  stage,
  onSuccess,
  onMistake,
  variant = "typing",
  helpLevel: externalHelpLevel = 0
}: TypingLessonExperienceProps) => {
  const { playClickSound, playErrorSound, playSuccessSound } = useFeedbackSound();
  const answerText = stage.answerEn || stage.promptEn || "";
  const englishPrompt = stage.promptEn || stage.answerEn || "Loading...";
  const translationText = (stage.promptCn || "").trim();
  const isDictationMode = variant === "dictation";
  const displaySentence = isDictationMode ? translationText || "请根据语音提示默写英文句子" : englishPrompt;
  const wordSlots = useMemo(() => buildWordSlots(answerText), [answerText]);

  const [wordInputs, setWordInputs] = useState<string[]>([]);
  const [wordErrors, setWordErrors] = useState<Record<number, boolean>>({});
  const [feedback, setFeedback] = useState<{ type: "correct" | "incorrect" | null; message?: string }>({ type: null });

  const prevHelpLevelRef = useRef(externalHelpLevel);
  const blockRefs = useRef<Array<HTMLInputElement | null>>([]);
  const successTimeoutRef = useRef<number | null>(null);

  const isInputLocked = feedback.type === "correct";

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

  useEffect(() => {
    setWordInputs(wordSlots.map(() => ""));
    setWordErrors({});
    setFeedback({ type: null });
    blockRefs.current = [];
    speak(stage.answerEn, { rate: 0.75, preferredLocales: ["en-US", "en-GB"] });

    setTimeout(() => {
      focusFirstWritableBlock();
    }, 100);
  }, [stage, wordSlots, focusFirstWritableBlock, variant]);

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
      e.preventDefault();
      focusBlock(index - 1);
    }
  };

  const handleWordInputChange = (index: number, rawValue: string) => {
    const slot = wordSlots[index];
    if (!slot) return;
    if (slot.fillableLength === 0) return;
    if (isInputLocked) return;

    // Extract only letters and digits from raw input (user types letters only)
    const lettersOnly = sanitizeLetters(rawValue).toLowerCase();

    // Count how many letters/digits the expected word has
    const expectedLetters = extractLettersDigits(slot.core);
    const maxLetters = expectedLetters.length;

    // Limit to max letters needed
    const trimmedLetters = lettersOnly.slice(0, maxLetters);

    // Auto-insert symbols at correct positions
    const withSymbols = autoInsertSymbols(trimmedLetters, slot.core);

    if (withSymbols !== wordInputs[index]) {
      playClickSound();
    }

    setWordInputs(prev => {
      const next = [...prev];
      next[index] = withSymbols;
      return next;
    });

    if (wordErrors[index]) {
      setWordErrors(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }

    if (feedback.type === "incorrect") {
      setFeedback({ type: null });
    }

    // Check if word is complete (all letters filled)
    if (trimmedLetters.length >= maxLetters) {
      const expected = slot.core.toLowerCase();

      if (withSymbols.toLowerCase() !== expected) {
        playErrorSound();
        setWordErrors(prev => ({ ...prev, [index]: true }));
      } else {
        focusNextBlock(index);
      }
    }
  };

  const checkAnswer = useCallback(() => {
    if (!answerText || !wordSlots.length || isInputLocked) return;

    const typedSentence = assembleWordInputs(wordSlots, wordInputs);
    const normalized = normalizeForCompare(typedSentence);
    const expected = normalizeForCompare(answerText);
    const variants = (stage.variants || []).map(v => normalizeForCompare(v));
    const allCorrectOptions = [expected, ...variants];

    if (allCorrectOptions.includes(normalized)) {
      setFeedback({ type: "correct", message: "Perfect!" });
      playSuccessSound();

      successTimeoutRef.current = window.setTimeout(() => {
        setWordInputs(wordSlots.map(() => ""));
        setWordErrors({});
        setFeedback({ type: null });
        onSuccess();
      }, 1000);
    } else {
      setFeedback({ type: "incorrect", message: "Not quite. Try again." });
      onMistake();
      playErrorSound();
      window.setTimeout(() => {
        setFeedback({ type: null });
      }, 360);
    }
  }, [answerText, wordSlots, wordInputs, isInputLocked, stage.variants, onSuccess, onMistake, playErrorSound, playSuccessSound]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.code === "Space") {
        event.preventDefault();
        speak(stage.answerEn, { rate: 0.75, preferredLocales: ["en-US", "en-GB"] });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, [stage.answerEn]);

  useEffect(() => {
    if (!isDictationMode) {
      prevHelpLevelRef.current = externalHelpLevel;
      return;
    }
    if (externalHelpLevel > prevHelpLevelRef.current) {
      speak(stage.answerEn, { rate: 0.7, preferredLocales: ["en-US", "en-GB"] });
    }
    prevHelpLevelRef.current = externalHelpLevel;
  }, [externalHelpLevel, isDictationMode, stage.answerEn]);

  const requiredWordCount = wordSlots.filter(slot => slot.fillableLength > 0).length;
  const completedWordCount = wordSlots.filter(
    (slot, index) => {
      if (slot.fillableLength === 0) return true;
      const expectedLetters = extractLettersDigits(slot.core).length;
      const inputLetters = extractLettersDigits(wordInputs[index] ?? "").length;
      return inputLetters >= expectedLetters;
    }
  ).length;
  const isSubmitDisabled = isInputLocked || !requiredWordCount || completedWordCount !== requiredWordCount;
  const showHintLetters = isDictationMode && externalHelpLevel >= 1;
  const showAnswerReveal = isDictationMode && externalHelpLevel >= 2;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div className="flex flex-col items-center w-full max-w-2xl px-6">

        {/* Sentence Display */}
        <div className="text-center mb-8">
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
            {displaySentence}
          </h3>
          {!isDictationMode && translationText && (
            <p className="text-base text-slate-400 dark:text-slate-500 mt-3">{translationText}</p>
          )}
          {showAnswerReveal && (
            <p className="text-base text-amber-600 dark:text-amber-400 mt-3 font-medium">{englishPrompt}</p>
          )}
        </div>

        {/* Word Slots - Natural Flow */}
        <div className="w-full flex flex-wrap items-baseline justify-center gap-x-3 gap-y-4 leading-loose mb-8">
          {wordSlots.map((slot, index) => {
            const slotWidthCh = getSlotWidthCh(slot);
            const isLockedSlot = slot.fillableLength === 0;

            return (
              <div key={slot.id} className="inline-flex items-baseline">
                {isLockedSlot ? (
                  <span className="text-2xl sm:text-3xl font-semibold text-slate-600 dark:text-slate-300 select-none px-0.5">
                    {slot.core}
                  </span>
                ) : (
                  <div className="relative inline-flex items-baseline">
                    {/* Hint Letter */}
                    {!wordInputs[index] && showHintLetters && (
                      <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-[10px] font-medium text-amber-400/70 tracking-wider pointer-events-none">
                        {slot.core.charAt(0).toUpperCase()}
                      </span>
                    )}

                    <input
                      ref={el => { blockRefs.current[index] = el; }}
                      value={wordInputs[index] ?? ""}
                      onChange={e => handleWordInputChange(index, e.target.value)}
                      onKeyDown={e => handleWordKeyDown(e, index)}
                      maxLength={slot.fillableLength || undefined}
                      disabled={isInputLocked}
                      style={{ width: `${slotWidthCh + 0.5}ch` }}
                      className={classNames(
                        "bg-transparent text-2xl sm:text-3xl font-semibold text-center outline-none transition-colors font-mono",
                        wordErrors[index]
                          ? "text-rose-500 border-b border-rose-400 lesson-animate-shake"
                          : wordInputs[index]
                            ? "text-slate-800 dark:text-slate-100 border-b border-orange-400"
                            : "text-slate-800 dark:text-slate-100 border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-orange-400 focus:border-solid"
                      )}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck="false"
                    />

                    {slot.suffix && (
                      <span className="text-2xl sm:text-3xl font-semibold text-slate-600 dark:text-slate-300 select-none">
                        {slot.suffix}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Feedback */}
        <div className="h-10 flex items-center justify-center mb-4">
          {feedback.type && (
            <div className={classNames(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold animate-in fade-in zoom-in duration-200",
              feedback.type === "correct"
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
            )}>
              {feedback.type === "correct" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {feedback.message}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-2 rounded-full bg-slate-900 dark:bg-slate-100 px-6 py-2.5 text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
            onClick={() => { playClickSound(); checkAnswer(); }}
            disabled={isSubmitDisabled}
          >
            提交
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            className="p-2.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={() => { playClickSound(); speak(stage.answerEn, { rate: 0.75, preferredLocales: ["en-US", "en-GB"] }); }}
            title="再听一遍"
          >
            <Volume2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            className="p-2.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
            onClick={() => { playClickSound(); setWordInputs(wordSlots.map(() => "")); setWordErrors({}); setFeedback({ type: null }); focusFirstWritableBlock(); }}
            title="清空"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
