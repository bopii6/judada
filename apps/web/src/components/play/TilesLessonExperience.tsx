import { useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import type { CourseStage } from "../../api/courses";
import { speak } from "../../hooks/useTTS";
import { useFeedbackSound } from "../../hooks/useFeedbackSoundHook";
import { Volume2, RotateCcw } from "lucide-react";

export interface TilesLessonExperienceProps {
  stage: CourseStage;
  index?: number;
  total?: number;
  onSuccess: () => void;
  onMistake: () => void;
}

interface TokenChip {
  id: string;
  text: string;
  order: number;
  slot: number;
}

const createTokenChips = (stage: CourseStage): TokenChip[] =>
  stage.answerEn
    .split(/\s+/)
    .filter(Boolean)
    .map((word, order) => ({
      id: `${stage.id}-${order}`,
      text: word.trim(),
      order,
      slot: order
    }));

const initializePool = (tokens: TokenChip[]) => {
  const shuffled = [...tokens];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map((token, index) => ({
    ...token,
    slot: index
  }));
};

const restoreTokenIntoPool = (pool: TokenChip[], token: TokenChip) => {
  const withoutToken = pool.filter(entry => entry.id !== token.id);
  return [...withoutToken, token].sort((a, b) => a.slot - b.slot);
};

export const TilesLessonExperience = ({ stage, onSuccess, onMistake }: TilesLessonExperienceProps) => {
  const { playClickSound, playErrorSound, playSuccessSound } = useFeedbackSound();
  const canonicalTokens = useMemo(() => createTokenChips(stage), [stage]);
  const [pool, setPool] = useState<TokenChip[]>(() => initializePool(canonicalTokens));
  const [selected, setSelected] = useState<TokenChip[]>([]);
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const errorTimeoutRef = useRef<number | null>(null);
  const successTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (errorTimeoutRef.current) {
      window.clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }

    const tokens = createTokenChips(stage);
    setPool(initializePool(tokens));
    setSelected([]);
    setStatus("idle");
    speak(stage.answerEn, { rate: 0.75, preferredLocales: ["en-US", "en-GB"] });
  }, [stage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        speak(stage.answerEn, { rate: 0.75, preferredLocales: ["en-US", "en-GB"] });
      }
      if (event.code === "Backspace") {
        event.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (errorTimeoutRef.current) {
        window.clearTimeout(errorTimeoutRef.current);
      }
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.answerEn]);

  const handleUndo = () => {
    setSelected(prev => {
      if (!prev.length) return prev;
      const nextSelected = [...prev];
      const token = nextSelected.pop();
      if (!token) return prev;
      setPool(current => restoreTokenIntoPool(current, token));
      playClickSound();
      setStatus("idle");
      return nextSelected;
    });
  };

  const handleSelect = (token: TokenChip) => {
    if (status === "success") return;

    playClickSound();
    setPool(prev => prev.filter(entry => entry.id !== token.id));
    setSelected(prev => {
      const nextSelected = [...prev, token];
      const expectedIndex = nextSelected.length - 1;
      const isCorrectSoFar = token.order === expectedIndex;

      if (!isCorrectSoFar) {
        setStatus("error");
        onMistake();
        playErrorSound();
        errorTimeoutRef.current = window.setTimeout(() => {
          setSelected(current => current.filter(entry => entry.id !== token.id));
          setPool(current => restoreTokenIntoPool(current, token));
          setStatus("idle");
        }, 420);
        return nextSelected;
      }

      const finished = nextSelected.length === canonicalTokens.length;
      if (finished) {
        setStatus("success");
        playSuccessSound();
        successTimeoutRef.current = window.setTimeout(() => {
          onSuccess();
        }, 480);
      } else {
        setStatus("idle");
      }

      return nextSelected;
    });
  };

  const displaySentence = stage.promptEn || stage.answerEn || "Loading...";
  const translationText = stage.promptCn || "";

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div className="flex flex-col items-center w-full max-w-2xl px-6">

        {/* Sentence Display */}
        <div className="text-center mb-6">
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
            {displaySentence}
          </h3>
          {translationText && (
            <p className="text-base text-slate-400 dark:text-slate-500 mt-2">{translationText}</p>
          )}
        </div>

        {/* Answer Box */}
        <div className={classNames(
          "w-full min-h-[80px] rounded-2xl border px-5 py-4 mb-6 transition-all duration-200",
          status === "idle" && "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50",
          status === "error" && "border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 lesson-animate-shake",
          status === "success" && "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20"
        )}>
          <div className="flex flex-wrap items-center justify-center gap-2 min-h-[40px]">
            {selected.length === 0 && (
              <span className="text-sm text-slate-300 dark:text-slate-600 select-none">
                点击下方词块组成句子
              </span>
            )}
            {selected.map(token => (
              <span
                key={token.id}
                className="rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 px-3 py-1.5 text-base font-semibold animate-in zoom-in duration-150"
              >
                {token.text}
              </span>
            ))}
          </div>
        </div>

        {/* Word Tiles Pool */}
        <div className="w-full flex flex-wrap items-center justify-center gap-2 mb-6">
          {pool.map(token => (
            <button
              key={token.id}
              type="button"
              className={classNames(
                "rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-2 text-base font-semibold text-slate-700 dark:text-slate-200 transition-all",
                status === "success"
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:border-orange-300 dark:hover:border-orange-500 hover:text-orange-600 dark:hover:text-orange-400 active:scale-95"
              )}
              onClick={() => handleSelect(token)}
              disabled={status === "success"}
            >
              {token.text}
            </button>
          ))}
          {!pool.length && selected.length !== canonicalTokens.length && (
            <span className="text-sm text-slate-400 dark:text-slate-500">
              所有词块都已使用
            </span>
          )}
        </div>

        {/* Actions - Compact */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={() => { playClickSound(); speak(stage.answerEn, { rate: 0.75, preferredLocales: ["en-US", "en-GB"] }); }}
          >
            <Volume2 className="w-4 h-4" />
            <span className="text-sm font-medium">再听一遍</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
            onClick={() => { playClickSound(); handleUndo(); }}
            disabled={selected.length === 0}
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm font-medium">撤回</span>
          </button>
        </div>
      </div>
    </div>
  );
};
