import { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import type { CourseStage } from "../../api/courses";
import { normalizeForCompare } from "@judada/shared/text";
import { speak } from "../../hooks/useTTS";
import { playClickSound, playErrorSound, playSuccessSound } from "../../hooks/useFeedbackSound";
import { Volume2, Trash2, ArrowRight } from "lucide-react";

export interface TypingLessonExperienceProps {
  stage: CourseStage;
  index?: number;
  total?: number;
  onSuccess: () => void;
  onMistake: () => void;
}

export const TypingLessonExperience = ({ stage, onSuccess, onMistake }: TypingLessonExperienceProps) => {
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
    "mt-8 w-full rounded-[2rem] border-2 px-8 py-6 text-2xl font-bold text-slate-800 shadow-sm outline-none transition-all duration-300 resize-none placeholder:text-slate-300",
    {
      "border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100": status === "idle",
      "lesson-animate-shake border-red-300 bg-red-50 focus:ring-4 focus:ring-red-100": status === "error",
      "lesson-animate-pop border-emerald-300 bg-emerald-50 focus:ring-4 focus:ring-emerald-100": status === "success"
    }
  );

  return (
    <div className="flex h-full w-full flex-col items-center justify-between gap-8">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Type the translation</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-800 leading-relaxed drop-shadow-sm">
            {stage.promptCn}
          </h3>
        </div>

        <div className="w-full relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            className={inputClass}
            rows={3}
            placeholder="输入对应的英文句子..."
          />
          <div className="absolute bottom-4 right-4 flex gap-2">
            {status === "error" && (
              <span className="text-sm font-bold text-red-500 bg-white px-3 py-1 rounded-full shadow-sm animate-in fade-in slide-in-from-bottom-1">
                再试一次 💪
              </span>
            )}
            {status === "success" && (
              <span className="text-sm font-bold text-emerald-500 bg-white px-3 py-1 rounded-full shadow-sm animate-in fade-in slide-in-from-bottom-1">
                太棒了！ ✨
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 w-full justify-center border-t border-slate-100 pt-6">
        <button
          type="button"
          className="group flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-white font-bold shadow-lg shadow-slate-200 hover:bg-indigo-600 hover:scale-105 transition-all active:scale-95"
          onClick={() => {
            playClickSound();
            handleSubmit();
          }}
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
            setInput("");
          }}
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
