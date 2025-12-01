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

  return (
    <div className="flex h-full w-full flex-col items-center justify-between gap-8">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl">
        <div className="w-full">
          <div className="rounded-[32px] border border-slate-100 bg-gradient-to-br from-white to-slate-50 shadow-sm px-6 py-6 sm:px-10 space-y-4 text-center">
            {!isDictationMode && (
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
                英文句子
              </div>
            )}

            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 leading-relaxed drop-shadow-sm max-w-2xl mx-auto">
              {displaySentence}
            </h3>
            {!isDictationMode && translationText && (
              <p className="text-sm text-slate-500 max-w-2xl mx-auto">{translationText}</p>
            )}

            {showAnswerReveal && (
              <div className="px-4 py-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 text-sm font-semibold shadow-sm text-center max-w-2xl mx-auto">
                {englishPrompt}
              </div>
            )}
          </div>
        </div>

        {/* Word Slots Input Area - 与音乐闯关一致的布局 */}
        <div className="mt-8 w-full">
          <div className="rounded-[32px] border border-slate-100 bg-white/70 px-4 py-6 sm:px-8 shadow-inner">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {wordSlots.map((slot, index) => {
                const slotWidthCh = getSlotWidthCh(slot);
                const isLockedSlot = slot.fillableLength === 0;
                return (
                  <div key={slot.id} className="flex flex-col items-center">
                    <div
                      className={classNames(
                        "relative group/input flex items-center justify-center rounded-2xl border-2 px-4 py-3 bg-white/90 shadow-sm transition-all",
                        isLockedSlot
                          ? "border-transparent bg-transparent shadow-none"
                          : wordErrors[index]
                            ? "border-rose-200 shadow-rose-100 lesson-animate-shake"
                            : "border-slate-200 hover:border-indigo-200"
                      )}
                    >
                      {isLockedSlot ? (
                        <span className="text-2xl font-bold text-slate-300">{slot.core}</span>
                      ) : (
                        <>
                          {!wordInputs[index] && (slot.prefill || (showHintLetters && slot.fillableLength > 0)) && (
                            <span
                              className={classNames(
                                "absolute left-3 top-2 text-[10px] font-semibold tracking-[0.3em]",
                                showHintLetters ? "text-amber-500" : "text-slate-300"
                              )}
                            >
                              {(slot.prefill || slot.core.charAt(0)).toUpperCase()}
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
                              "bg-transparent text-2xl font-bold tracking-wide text-center outline-none transition-colors relative z-10",
                              wordErrors[index] ? "text-rose-500" : "text-slate-900",
                              "placeholder-transparent"
                            )}
                          />
                          <div
                            className={classNames(
                              "absolute inset-x-3 bottom-2 h-0.5 rounded-full transition-all duration-300",
                              wordErrors[index]
                                ? "bg-rose-400"
                                : "bg-slate-200 group-focus-within/input:bg-indigo-500 group-focus-within/input:h-1"
                            )}
                          />
                          {slot.suffix && (
                            <span className="absolute -right-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">
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
          </div>

          {/* Feedback Message */}
          {feedback.type && (
            <div className="mt-6 flex justify-center">
              <div
                className={classNames(
                  "flex items-center gap-3 px-5 py-3 rounded-full text-sm font-bold uppercase tracking-wider shadow-lg border animate-in fade-in zoom-in duration-300",
                  feedback.type === "correct"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100"
                    : "bg-rose-50 text-rose-600 border-rose-100 shadow-rose-100"
                )}
              >
                {feedback.type === "correct" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                {feedback.message}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center gap-4 w-full justify-center border-t border-slate-100 pt-6">
        <button
          type="button"
          className="group flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-white font-bold shadow-lg shadow-slate-200 hover:bg-indigo-600 hover:scale-105 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          onClick={() => {
            playClickSound();
            checkAnswer();
          }}
          disabled={isSubmitDisabled}
        >
          <span>提交</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>

        <div className="h-8 w-px bg-slate-200 mx-2"></div>

        <button
          type="button"
          className="p-3 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="重播提示 (Ctrl + Space)"
          onClick={() => {
            playClickSound();
            speak(stage.answerEn, { rate: 0.95, preferredLocales: ["en-US", "en-GB"] });
          }}
        >
          <Volume2 className="w-5 h-5" />
        </button>

        <button
          type="button"
          className="p-3 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
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
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
