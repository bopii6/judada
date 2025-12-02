import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import type { CourseStage } from "../../api/courses";
import { speak } from "../../hooks/useTTS";
import { playClickSound, playErrorSound, playSuccessSound } from "../../hooks/useFeedbackSound";
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
      prefill: "",
      fillableLength: core.length
    };
  });

  return slots;
};

const assembleWordInputs = (slots: WordSlot[], inputs: string[]): string =>
  slots
    .map((slot, index) => {
      if (!slot.length) return slot.core;
      const typedPart = (inputs[index] ?? "").trim();
      const combined = typedPart;
      if (!combined.trim()) return "";
      return slot.suffix ? `${combined}${slot.suffix}` : combined;
    })
    .filter(Boolean)
    .join(" ");

// 与音乐闯关保持一致的文本标准化逻辑
const normalizeForCompare = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['"`""'']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getSlotWidthCh = (slot: WordSlot) => {
  const base = slot.fillableLength || slot.length || 1;
  return Math.min(Math.max(base, 2.5), 8);
};

export const TypingLessonExperience = ({
  stage,
  onSuccess,
  onMistake,
  variant = "typing",
  helpLevel: externalHelpLevel = 0
}: TypingLessonExperienceProps) => {
  const answerText = stage.answerEn || stage.promptEn || "";
  const englishPrompt = stage.promptEn || stage.answerEn || "Loading...";
  const translationText = (stage.promptCn || "").trim();
  const isDictationMode = variant === "dictation";
  const displaySentence = isDictationMode ? translationText || "请根据语音提示默写英文句子" : englishPrompt;
  const wordSlots = useMemo(() => buildWordSlots(answerText), [answerText]);

  const [wordInputs, setWordInputs] = useState<string[]>([]);
  const [wordErrors, setWordErrors] = useState<Record<number, boolean>>({});
  const [feedback, setFeedback] = useState<{ type: "correct" | "incorrect" | null; message?: string }>({ type: null });
  const [autoCheckLocked, setAutoCheckLocked] = useState(false);

  const prevHelpLevelRef = useRef(externalHelpLevel);

  const blockRefs = useRef<Array<HTMLInputElement | null>>([]);
  const successTimeoutRef = useRef<number | null>(null);

  // 输入锁定：当答案正确时锁定输入（与音乐闯关保持一致）
  const isInputLocked = feedback.type === "correct";

  // 聚焦函数
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

  // 初始化wordInputs（依赖聚焦函数，因此放在其定义之后）
  useEffect(() => {
    setWordInputs(wordSlots.map(() => ""));
    setWordErrors({});
    setFeedback({ type: null });
    setAutoCheckLocked(false);
    blockRefs.current = [];
    speak(stage.answerEn, { rate: 0.95, preferredLocales: ["en-US", "en-GB"] });

    // 自动聚焦第一个可输入框
    setTimeout(() => {
      focusFirstWritableBlock();
    }, 100);
  }, [stage, wordSlots, focusFirstWritableBlock, variant]);

  // 键盘事件处理
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

  // 单词输入变化处理
  const handleWordInputChange = (index: number, rawValue: string) => {
    const slot = wordSlots[index];
    if (!slot) return;
    if (slot.fillableLength === 0) return;
    if (isInputLocked) return;

    const sanitized = sanitizeLetters(rawValue)
      .slice(0, slot.fillableLength || undefined)
      .toLowerCase();

    if (sanitized !== wordInputs[index]) {
      playClickSound();
    }

    setWordInputs(prev => {
      const next = [...prev];
      next[index] = sanitized;
      return next;
    });
    setAutoCheckLocked(false);

    // 清除错误状态
    if (wordErrors[index]) {
      setWordErrors(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }

    // 清除反馈
    if (feedback.type === "incorrect") {
      setFeedback({ type: null });
    }

    // 如果填满了，自动移到下一个
    if (slot.fillableLength && sanitized.length >= slot.fillableLength) {
      const fullWord = sanitized.toLowerCase();
      const expected = slot.core.toLowerCase();

      if (fullWord !== expected) {
        playErrorSound();
        setWordErrors(prev => ({ ...prev, [index]: true }));
      } else {
        focusNextBlock(index);
      }
    }
  };

  // 检查答案
  const checkAnswer = useCallback(() => {
    if (!answerText || !wordSlots.length || isInputLocked) return;

    const typedSentence = assembleWordInputs(wordSlots, wordInputs);
    const normalized = normalizeForCompare(typedSentence);
    const expected = normalizeForCompare(answerText);
    const variants = (stage.variants || []).map(v => normalizeForCompare(v));
    const allCorrectOptions = [expected, ...variants];

    if (allCorrectOptions.includes(normalized)) {
      setFeedback({ type: "correct", message: "Perfect!" });
      setAutoCheckLocked(false);
      playSuccessSound();

      successTimeoutRef.current = window.setTimeout(() => {
        setWordInputs(wordSlots.map(() => ""));
        setWordErrors({});
        setFeedback({ type: null });
        setAutoCheckLocked(false);
        onSuccess();
      }, 1000);
    } else {
      setAutoCheckLocked(true);
      setFeedback({ type: "incorrect", message: "Not quite. Listen again." });
      onMistake();
      playErrorSound();
      window.setTimeout(() => {
        setFeedback({ type: null });
      }, 360);
    }
  }, [answerText, wordSlots, wordInputs, isInputLocked, stage.variants, onSuccess, onMistake]);

  // 自动检查（当所有单词填满时）
  useEffect(() => {
    const requiredWordCount = wordSlots.filter(slot => slot.fillableLength > 0).length;
    const completedWordCount = wordSlots.filter(
      (slot, index) => slot.fillableLength === 0 || (wordInputs[index]?.length ?? 0) === slot.fillableLength
    ).length;

    if (
      requiredWordCount > 0 &&
      completedWordCount === requiredWordCount &&
      !isInputLocked &&
      !feedback.type &&
      !autoCheckLocked
    ) {
      const timer = setTimeout(() => {
        checkAnswer();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [wordInputs, wordSlots, isInputLocked, feedback.type, autoCheckLocked, checkAnswer]);

  // 全局键盘事件
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.code === "Space") {
        event.preventDefault();
        speak(stage.answerEn, { rate: 0.95, preferredLocales: ["en-US", "en-GB"] });
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
      speak(stage.answerEn, { rate: 0.9, preferredLocales: ["en-US", "en-GB"] });
    }
    prevHelpLevelRef.current = externalHelpLevel;
  }, [externalHelpLevel, isDictationMode, stage.answerEn]);

  const requiredWordCount = wordSlots.filter(slot => slot.fillableLength > 0).length;
  const completedWordCount = wordSlots.filter(
    (slot, index) => slot.fillableLength === 0 || (wordInputs[index]?.length ?? 0) === slot.fillableLength
  ).length;
  const isSubmitDisabled = isInputLocked || !requiredWordCount || completedWordCount !== requiredWordCount;
  const showHintLetters = isDictationMode && externalHelpLevel >= 1;
  const showAnswerReveal = isDictationMode && externalHelpLevel >= 2;

  // 计算单词数量，分成两行，第二行比第一行长
  const totalSlots = wordSlots.length;
  // 第一行约占总数的40%，第二行约60%，确保第二行更长
  const firstLineCount = Math.max(1, Math.floor(totalSlots * 0.4));
  const firstLineSlots = wordSlots.slice(0, firstLineCount);
  const secondLineSlots = wordSlots.slice(firstLineCount);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center justify-center w-full max-w-4xl">
        {/* Title Section */}
        <div className="w-full mb-10">
          <div className="text-center">
            {!isDictationMode && (
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-4 py-1.5 text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider ring-1 ring-indigo-100 dark:ring-indigo-800 mb-6">
                英文句子
              </div>
            )}

            <h3 className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-slate-100 leading-tight tracking-tight drop-shadow-sm max-w-3xl mx-auto">
              {displaySentence}
            </h3>
          </div>
        </div>

        {/* Translation Section - First Red Box Area */}
        <div className="w-full mb-14 min-h-[60px] flex items-center justify-center">
          <div className="text-center">
            {!isDictationMode && translationText && (
              <p className="text-lg text-slate-500 dark:text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">{translationText}</p>
            )}

            {showAnswerReveal && (
              <div className="px-6 py-4 rounded-2xl bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-base font-bold shadow-sm text-center max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2">
                {englishPrompt}
              </div>
            )}
          </div>
        </div>

        {/* Word Slots Input Area - Second Red Box Area (Two Rows) */}
        <div className="w-full mb-20">
          <div className="flex flex-col items-center justify-center gap-y-6">
            {/* First Row */}
            <div className="flex flex-wrap items-baseline justify-center gap-x-1.5 leading-relaxed max-w-3xl">
              {firstLineSlots.map((slot, index) => {
                const slotWidthCh = getSlotWidthCh(slot);
                const isLockedSlot = slot.fillableLength === 0;
                return (
                  <div key={slot.id} className="inline-flex items-baseline">
                    <div
                      className={classNames(
                        "relative inline-flex items-center justify-center transition-all duration-200",
                        isLockedSlot
                          ? "px-1"
                          : "px-2"
                      )}
                    >
                      {isLockedSlot ? (
                        <span className="text-3xl sm:text-4xl font-bold text-slate-700 dark:text-slate-200 select-none">{slot.core}</span>
                      ) : (
                        <>
                          {!wordInputs[index] && (slot.prefill || (showHintLetters && slot.fillableLength > 0)) && (
                            <span
                              className={classNames(
                                "absolute left-1/2 -translate-x-1/2 bottom-1 text-xs font-medium tracking-[0.15em] pointer-events-none transition-opacity",
                                showHintLetters ? "text-amber-400/80 dark:text-amber-500/80" : "text-slate-300/60 dark:text-slate-600/60"
                              )}
                            >
                              {(slot.prefill || slot.core).toUpperCase()}
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
                            disabled={isInputLocked}
                            style={{ width: `${slotWidthCh}ch` }}
                            className={classNames(
                              "bg-transparent text-3xl sm:text-4xl font-bold tracking-wide text-center outline-none transition-all relative z-10 font-mono pb-1",
                              wordErrors[index]
                                ? "text-rose-500 dark:text-rose-400 border-b-2 border-rose-400 dark:border-rose-500 lesson-animate-shake"
                                : wordInputs[index]
                                  ? "text-slate-800 dark:text-slate-100 border-b-2 border-indigo-400 dark:border-indigo-500"
                                  : "text-slate-800 dark:text-slate-100 border-b-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 focus:border-solid focus:border-indigo-500 dark:focus:border-indigo-400",
                              "placeholder-transparent"
                            )}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck="false"
                          />

                          {slot.suffix && (
                            <span className="ml-0.5 text-3xl sm:text-4xl font-bold text-slate-700 dark:text-slate-200 select-none">
                              {slot.suffix}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Second Row */}
            {secondLineSlots.length > 0 && (
              <div className="flex flex-wrap items-baseline justify-center gap-x-1.5 leading-relaxed max-w-3xl">
                {secondLineSlots.map((slot, originalIndex) => {
                  const index = firstLineCount + originalIndex;
                  const slotWidthCh = getSlotWidthCh(slot);
                  const isLockedSlot = slot.fillableLength === 0;
                  return (
                    <div key={slot.id} className="inline-flex items-baseline">
                      <div
                        className={classNames(
                          "relative inline-flex items-center justify-center transition-all duration-200",
                          isLockedSlot
                            ? "px-1"
                            : "px-2"
                        )}
                      >
                        {isLockedSlot ? (
                          <span className="text-3xl sm:text-4xl font-bold text-slate-700 dark:text-slate-200 select-none">{slot.core}</span>
                        ) : (
                          <>
                            {!wordInputs[index] && (slot.prefill || (showHintLetters && slot.fillableLength > 0)) && (
                              <span
                                className={classNames(
                                  "absolute left-1/2 -translate-x-1/2 bottom-1 text-xs font-medium tracking-[0.15em] pointer-events-none transition-opacity",
                                  showHintLetters ? "text-amber-400/80 dark:text-amber-500/80" : "text-slate-300/60 dark:text-slate-600/60"
                                )}
                              >
                                {(slot.prefill || slot.core).toUpperCase()}
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
                              disabled={isInputLocked}
                              style={{ width: `${slotWidthCh}ch` }}
                              className={classNames(
                                "bg-transparent text-3xl sm:text-4xl font-bold tracking-wide text-center outline-none transition-all relative z-10 font-mono pb-1",
                                wordErrors[index]
                                  ? "text-rose-500 dark:text-rose-400 border-b-2 border-rose-400 dark:border-rose-500 lesson-animate-shake"
                                  : wordInputs[index]
                                    ? "text-slate-800 dark:text-slate-100 border-b-2 border-indigo-400 dark:border-indigo-500"
                                    : "text-slate-800 dark:text-slate-100 border-b-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 focus:border-solid focus:border-indigo-500 dark:focus:border-indigo-400",
                                "placeholder-transparent"
                              )}
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck="false"
                            />

                            {slot.suffix && (
                              <span className="ml-0.5 text-3xl sm:text-4xl font-bold text-slate-700 dark:text-slate-200 select-none">
                                {slot.suffix}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Feedback Message */}
          <div className="h-12 mt-8 flex items-center justify-center">
            {feedback.type && (
              <div
                className={classNames(
                  "flex items-center gap-3 px-6 py-3 rounded-2xl text-base font-bold shadow-xl border animate-in fade-in zoom-in duration-300",
                  feedback.type === "correct"
                    ? "bg-emerald-500 dark:bg-emerald-600 text-white border-emerald-600 dark:border-emerald-500 shadow-emerald-500/30"
                    : "bg-white dark:bg-slate-800 text-rose-500 dark:text-rose-400 border-rose-100 dark:border-rose-800 shadow-rose-200 dark:shadow-rose-900/30"
                )}
              >
                {feedback.type === "correct" ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
                {feedback.message}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Bar - Third Red Box Area */}
        <div className="flex items-center gap-3 w-full justify-center pt-10">
          <button
            type="button"
            className="group flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-700 px-5 py-2.5 text-white dark:text-slate-100 text-sm font-semibold shadow-lg shadow-slate-900/20 dark:shadow-slate-900/40 hover:bg-slate-800 dark:hover:bg-slate-600 hover:scale-[1.02] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
            onClick={() => {
              playClickSound();
              checkAnswer();
            }}
            disabled={isSubmitDisabled}
          >
            <span>提交答案</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

          <button
            type="button"
            className="p-2.5 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-all active:scale-95"
            title="重播提示 (Ctrl + Space)"
            onClick={() => {
              playClickSound();
              speak(stage.answerEn, { rate: 0.95, preferredLocales: ["en-US", "en-GB"] });
            }}
          >
            <Volume2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            className="p-2.5 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-500 dark:hover:text-rose-400 transition-all active:scale-95"
            title="清空"
            onClick={() => {
              playClickSound();
              setWordInputs(wordSlots.map(() => ""));
              setWordErrors({});
              setFeedback({ type: null });
              setAutoCheckLocked(false);
              focusFirstWritableBlock();
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
