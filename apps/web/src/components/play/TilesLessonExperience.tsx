import { useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import type { CourseStage } from "../../api/courses";
import { speak } from "../../hooks/useTTS";
import { playClickSound, playErrorSound, playSuccessSound } from "../../hooks/useFeedbackSound";
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
    speak(stage.answerEn, { rate: 0.95, preferredLocales: ["en-US", "en-GB"] });
  }, [stage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        speak(stage.answerEn, { rate: 0.95, preferredLocales: ["en-US", "en-GB"] });
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

  const answerBoxClass = classNames(
    "min-h-[120px] w-full rounded-[2rem] border-2 px-8 py-6 text-2xl font-bold tracking-wide shadow-sm transition-all duration-300 flex items-center",
    {
      "border-slate-100 bg-white": status === "idle",
      "lesson-animate-shake border-red-200 bg-red-50 ring-4 ring-red-100": status === "error",
      "lesson-animate-pop border-emerald-200 bg-emerald-50 ring-4 ring-emerald-100": status === "success"
    }
  );

  const tileButtonClass = (disabled: boolean) =>
    classNames(
      "rounded-2xl bg-white border-b-4 border-slate-200 px-6 py-3 text-lg font-bold text-slate-700 shadow-sm transition-all active:border-b-0 active:translate-y-1 hover:-translate-y-0.5",
      {
        "opacity-50 pointer-events-none": disabled,
        "hover:border-indigo-200 hover:text-indigo-600": !disabled
      }
    );

  return (
    <div className="flex h-full w-full flex-col items-center justify-between gap-8">
      <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full max-w-3xl">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Translate this sentence</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-800 leading-relaxed">
            {stage.promptCn}
          </h3>
        </div>

        <div className={answerBoxClass}>
          <div className="flex flex-wrap items-center gap-3 w-full">
            {selected.length === 0 && (
              <span className="text-lg font-medium text-slate-300 select-none">
                点击下方词块组成句子
              </span>
            )}
            {selected.map(token => (
              <span
                key={token.id}
                className="rounded-xl bg-sky-100 text-sky-700 border border-sky-200 px-4 py-2 text-lg font-bold shadow-sm animate-in zoom-in duration-200"
              >
                {token.text}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 w-full">
          {pool.map(token => (
            <button
              key={token.id}
              type="button"
              className={tileButtonClass(status === "success")}
              onClick={() => handleSelect(token)}
              disabled={status === "success"}
            >
              {token.text}
            </button>
          ))}
          {!pool.length && selected.length !== canonicalTokens.length && (
            <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-400">
              所有词块都已使用
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 w-full justify-center border-t border-slate-100 pt-6">
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 transition-colors"
          onClick={() => {
            playClickSound();
            speak(stage.answerEn, { rate: 0.95, preferredLocales: ["en-US", "en-GB"] });
          }}
        >
          <Volume2 className="w-5 h-5" />
          <span className="text-sm">再听一遍 (Space)</span>
        </button>
        <div className="h-4 w-px bg-slate-200"></div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 transition-colors disabled:opacity-40"
          onClick={() => {
            playClickSound();
            handleUndo();
          }}
          disabled={selected.length === 0}
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-sm">撤回 (Backspace)</span>
        </button>
      </div>
    </div>
  );
};
