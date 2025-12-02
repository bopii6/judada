import { useEffect, useRef, useState } from "react";
import type { Question, PlacementSubmitResponse } from "../api/types";
import api from "../api/client";
import { normalizeForCompare } from "@judada/shared";
import { speak } from "../hooks/useTTS";
import { vibrate } from "../hooks/useVibration";

interface PlacementBoardProps {
  sessionId: string;
  questions: Question[];
  onFinished(result: PlacementSubmitResponse): void;
}

interface PlacementRecordPayload {
  questionId: string;
  answerText: string;
  durationMs: number;
}

export const PlacementBoard = ({ sessionId, questions, onFinished }: PlacementBoardProps) => {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [records, setRecords] = useState<PlacementRecordPayload[]>([]);
  const [status, setStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const startedAtRef = useRef(Date.now());

  const currentQuestion = questions[index];

  useEffect(() => {
    if (currentQuestion) {
      speak(currentQuestion.en);
      startedAtRef.current = Date.now();
    }
  }, [currentQuestion]);

  const submitPlacement = async (payload: PlacementRecordPayload[]) => {
    setSubmitting(true);
    try {
      const { data } = await api.post<PlacementSubmitResponse>('/placement/submit', {
        sessionId,
        records: payload
      });
      onFinished(data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('placement submit failed', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!currentQuestion || submitting) return;
    const duration = Date.now() - startedAtRef.current;
    const nextRecord = {
      questionId: currentQuestion.id,
      answerText: input,
      durationMs: duration
    };
    const nextRecords = [...records, nextRecord];
    setRecords(nextRecords);

    const normalizedAnswer = normalizeForCompare(input);
    const target = normalizeForCompare(currentQuestion.en);
    const correct = normalizedAnswer === target || (currentQuestion.variants || []).some(variant => normalizeForCompare(variant) === normalizedAnswer);

    setStatus(correct ? 'correct' : 'incorrect');
    if (correct) {
      vibrate(30);
    }

    setInput('');

    setTimeout(() => {
      setStatus('idle');
      if (index + 1 >= questions.length) {
        submitPlacement(nextRecords);
      } else {
        setIndex(prev => prev + 1);
      }
    }, 500);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
    if (event.key === ' ' && event.ctrlKey) {
      event.preventDefault();
      if (currentQuestion) speak(currentQuestion.en);
    }
  };

  if (!currentQuestion) {
    return <div className="rounded-xl bg-white p-6">暂无定位测题目。</div>;
  }

  return (
    <div className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
      <div className="text-sm text-slate-500">定位测 {index + 1} / {questions.length}</div>
      <div className="text-2xl font-semibold text-slate-900">{currentQuestion.cn}</div>
      <textarea
        value={input}
        onChange={event => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        className={`w-full rounded-2xl border bg-slate-50 p-4 text-lg leading-relaxed shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 ${
          status === 'correct' ? 'border-green-500' : ''
        } ${status === 'incorrect' ? 'border-rose-400' : ''}`}
        rows={3}
        placeholder="输入英文句子"
        disabled={submitting}
      />
      <div className="flex items-center justify-between text-sm text-slate-500">
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-500 disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting}
        >
          提交
        </button>
        <button type="button" className="text-xs text-orange-600 hover:underline" onClick={() => speak(currentQuestion.en)}>
          重播语音
        </button>
      </div>
    </div>
  );
};


