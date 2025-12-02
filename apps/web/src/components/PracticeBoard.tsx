import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeForCompare } from "@judada/shared";
import api from "../api/client";
import type { Question } from "../api/types";
import { speak } from "../hooks/useTTS";
import { vibrate } from "../hooks/useVibration";

interface PracticeRecordPayload {
  questionId: string;
  answerText: string;
  durationMs: number;
  correct: boolean;
}

interface PracticeBoardProps {
  sessionId: string;
  questions: Question[];
  onFinished(): void;
}

export const PracticeBoard = ({ sessionId, questions, onFinished }: PracticeBoardProps) => {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [records, setRecords] = useState<PracticeRecordPayload[]>([]);
  const [status, setStatus] = useState<"idle" | "correct" | "incorrect">("idle");
  const startedAtRef = useRef(Date.now());

  const currentQuestion = questions[index];

  useEffect(() => {
    if (currentQuestion) {
      speak(currentQuestion.en);
      startedAtRef.current = Date.now();
    }
  }, [currentQuestion]);

  const progress = useMemo(() => (questions.length ? (index / questions.length) * 100 : 0), [index, questions.length]);

  const handleSubmit = async () => {
    if (!currentQuestion) return;
    const duration = Date.now() - startedAtRef.current;
    const normalizedAnswer = normalizeForCompare(input);
    const target = normalizeForCompare(currentQuestion.en);
    const variants = currentQuestion.variants ?? [];
    const correct =
      normalizedAnswer === target ||
      variants.some(variant => normalizeForCompare(variant) === normalizedAnswer);

    const nextRecord: PracticeRecordPayload = {
      questionId: currentQuestion.id,
      answerText: input,
      durationMs: duration,
      correct
    };
    const nextRecords = [...records, nextRecord];
    setRecords(nextRecords);

    setStatus(correct ? "correct" : "incorrect");
    if (correct) {
      speak("Great job!");
      vibrate(50);
    } else {
      speak("Keep trying!");
    }

    setInput("");

    setTimeout(() => {
      setStatus("idle");
      if (index + 1 >= questions.length) {
        if (sessionId && !sessionId.startsWith("preview")) {
          api
            .post("/records", { sessionId, records: nextRecords })
            .catch(error => {
              // eslint-disable-next-line no-console
              console.error("Failed to store practice records", error);
            })
            .finally(() => {
              onFinished();
            });
        } else {
          onFinished();
        }
      } else {
        setIndex(prev => prev + 1);
      }
    }, 600);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
    if (event.key === " " && event.ctrlKey) {
      event.preventDefault();
      if (currentQuestion) speak(currentQuestion.en);
    }
  };

  if (!currentQuestion) {
    return <div className="rounded-xl bg-white p-6">无可用的题目。</div>;
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-4 text-sm text-slate-500">
        题目 {index + 1} / {questions.length}
      </div>
      <h3 className="text-2xl font-semibold text-slate-900">{currentQuestion.cn}</h3>
      <p className="mt-1 text-sm text-slate-500">回答对应的英文句子，Enter 提交，Ctrl + Space 重播语音。</p>

      <textarea
        value={input}
        onChange={event => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        className={`mt-4 w-full rounded-2xl border bg-slate-50 p-4 text-lg shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          status === "correct" ? "border-green-500" : ""
        } ${status === "incorrect" ? "border-rose-400" : ""}`}
        rows={3}
        placeholder="输入你的答案..."
      />

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-500"
          onClick={handleSubmit}
        >
          提交
        </button>
        <button
          type="button"
          className="text-xs text-slate-500 hover:text-slate-700"
          onClick={() => speak(currentQuestion.en)}
        >
          重播提示
        </button>
      </div>

      <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};
