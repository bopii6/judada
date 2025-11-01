import { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import type { CourseStage } from "../../api/courses";
import { normalizeForCompare } from "@judada/shared";
import { speak } from "../../hooks/useTTS";
import { playClickSound, playErrorSound, playSuccessSound } from "../../hooks/useFeedbackSound";

export interface TypingLessonExperienceProps {
  stage: CourseStage;
  index: number;
  total: number;
  onSuccess: () => void;
  onMistake: () => void;
}

export const TypingLessonExperience = ({
  stage,
  index,
  total,
  onSuccess,
  onMistake
}: TypingLessonExperienceProps) => {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const successTimeoutRef = useRef<number | null>(null);
  const statusResetRef = useRef<number | null>(null);

  useEffect(() => {
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    if (statusResetRef.current) {
      window.clearTimeout(statusResetRef.current);
      statusResetRef.current = null;
    }
    setInput("");
    setStatus("idle");
    speak(stage.answerEn, { rate: 0.95, preferredLocales: ["en-US", "en-GB"] });
    textareaRef.current?.focus();
  }, [stage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
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
      if (statusResetRef.current) {
        window.clearTimeout(statusResetRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.answerEn, input]);

  const evaluateAnswer = () => {
    const normalizedAnswer = normalizeForCompare(input);
    const correctOptions = [stage.answerEn, ...(stage.variants ?? [])].map(entry => normalizeForCompare(entry));
    return correctOptions.includes(normalizedAnswer);
  };

  const handleSubmit = () => {
    if (!input.trim()) {
      setStatus("error");
      statusResetRef.current = window.setTimeout(() => setStatus("idle"), 280);
      return;
    }

    if (evaluateAnswer()) {
      setStatus("success");
      playSuccessSound();
      successTimeoutRef.current = window.setTimeout(() => {
        setStatus("idle");
        setInput("");
        onSuccess();
      }, 420);
    } else {
      setStatus("error");
      onMistake();
      playErrorSound();
      statusResetRef.current = window.setTimeout(() => setStatus("idle"), 360);
    }
  };

  const inputClass = classNames(
    "mt-6 w-full rounded-3xl border border-white/20 bg-white/15 px-6 py-5 text-2xl font-semibold text-white shadow-inner outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/40",
    {
      "lesson-animate-shake border-rose-400/80 bg-rose-500/20": status === "error",
      "lesson-animate-pop border-emerald-400/70 bg-emerald-400/20": status === "success"
    }
  );

  return (
    <div className="flex h-full flex-col items-center justify-center gap-10">
      <div className="text-sm uppercase tracking-[0.35em] text-white/60">键入练习 · {index + 1}/{total}</div>
      <div className="text-4xl font-semibold text-white drop-shadow-xl">{stage.promptCn}</div>
      <textarea
        ref={textareaRef}
        value={input}
        onChange={event => setInput(event.target.value)}
        className={inputClass}
        rows={3}
        placeholder="输入对应的英文句子"
      />
      {status === "error" && <p className="text-sm text-rose-100">答案不太对，再试一次！</p>}
      {status === "success" && <p className="text-sm text-emerald-100">太棒了！准备下一题。</p>}
      <div className="flex items-center gap-4 text-sm text-white/80">
        <button
          type="button"
          className="rounded-full bg-primary/90 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-primary"
          onClick={() => {
            playClickSound();
            handleSubmit();
          }}
        >
          提交 (Enter)
        </button>
        <button
          type="button"
          className="rounded-full border border-white/40 px-4 py-2 transition hover:border-white hover:bg-white/10"
          onClick={() => {
            playClickSound();
            speak(stage.answerEn, { rate: 0.95, preferredLocales: ["en-US", "en-GB"] });
          }}
        >
          重播提示 (Ctrl + Space)
        </button>
        <button
          type="button"
          className="rounded-full border border-white/40 px-4 py-2 transition hover:border-white hover:bg-white/10"
          onClick={() => {
            playClickSound();
            setInput("");
          }}
        >
          清空
        </button>
      </div>
      <div className="text-xs uppercase tracking-[0.3em] text-white/50">
        尝试输入完整句子，少量拼写错误也会提示重试
      </div>
    </div>
  );
};
