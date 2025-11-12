import { useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import type { CourseStage } from "../../api/courses";
import { speak } from "../../hooks/useTTS";
import { playClickSound, playErrorSound, playSuccessSound } from "../../hooks/useFeedbackSound";

export interface TilesLessonExperienceProps {
  stage: CourseStage;
  index: number;
  total: number;
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

export const TilesLessonExperience = ({
  stage,
  index,
  total,
  onSuccess,
  onMistake
}: TilesLessonExperienceProps) => {
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
    "min-h-[96px] w-full rounded-2xl border border-white/20 bg-white/10 px-6 py-5 text-xl font-semibold tracking-wide text-white shadow-inner backdrop-blur",
    {
      "lesson-animate-shake ring-4 ring-rose-300/70 bg-rose-400/20": status === "error",
      "lesson-animate-pop ring-4 ring-emerald-300/70 bg-emerald-400/20": status === "success"
    }
  );

  const tileButtonClass = (disabled: boolean) =>
    classNames(
      "rounded-2xl bg-white/90 px-5 py-3 text-lg font-semibold text-slate-800 shadow transition hover:-translate-y-1 hover:shadow-lg",
      {
        "opacity-50 pointer-events-none": disabled
      }
    );

  return (
    <div className="flex h-full flex-col items-center justify-center gap-10">
      <div className="text-sm uppercase tracking-[0.35em] text-white/60">点词成句 · {index + 1}/{total}</div>
      <div className="text-4xl font-semibold text-white drop-shadow-xl">{stage.promptCn}</div>

      <div className={answerBoxClass}>
        <div className="flex flex-wrap items-center gap-3">
          {selected.length === 0 && <span className="text-base font-medium text-white/70">点击下方词块组成句子</span>}
          {selected.map(token => (
            <span
              key={token.id}
              className="rounded-xl bg-emerald-400/90 px-4 py-2 text-lg font-semibold text-emerald-950 shadow"
            >
              {token.text}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
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
          <div className="rounded-xl bg-white/20 px-4 py-2 text-sm text-white/70">所有词块都已使用</div>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-white/80">
        <button
          type="button"
          className="rounded-full border border-white/40 px-4 py-2 transition hover:border-white hover:bg-white/10"
          onClick={() => {
            playClickSound();
            speak(stage.answerEn, { rate: 0.95, preferredLocales: ["en-US", "en-GB"] });
          }}
        >
          再听一遍 (Space)
        </button>
        <button
          type="button"
          className="rounded-full border border-white/40 px-4 py-2 transition hover:border-white hover:bg-white/10 disabled:opacity-40"
          onClick={() => {
            playClickSound();
            handleUndo();
          }}
          disabled={selected.length === 0}
        >
          撤回 (Backspace)
        </button>
      </div>
    </div>
  );
};
