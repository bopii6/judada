import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api/client";
import type { QuestionBank, Question } from "../api/types";
import { useDeviceId } from "../hooks/useDeviceId";
import { PracticeBoard } from "../components/PracticeBoard";

interface BanksResponse {
  banks: QuestionBank[];
}

interface QuestionsResponse {
  questions: Question[];
}

export const Courses = () => {
  const deviceId = useDeviceId();
  const [active, setActive] = useState<{ sessionId: string; bank: QuestionBank; questions: Question[] } | null>(null);
  const { data: banks } = useQuery({ queryKey: ["banks"], queryFn: async () => (await api.get<BanksResponse>("/banks")).data.banks });

  const startPractice = async (bank: QuestionBank) => {
    if (!deviceId) return;
    const { data: session } = await api.post<{ sessionId: string }>("/sessions", {
      deviceId,
      mode: "training",
      bankId: bank.id
    });
    const { data: questionRes } = await api.get<QuestionsResponse>(`/banks/${bank.id}/questions`, {
      params: { limit: 10, tierMin: bank.levelMin, tierMax: bank.levelMax }
    });
    const normalizedQuestions = questionRes.questions.map(question => ({
      ...question,
      variants: Array.isArray(question.variants) ? question.variants : []
    }));
    setActive({ sessionId: session.sessionId, bank, questions: normalizedQuestions });
  };

  if (active) {
    return (
      <div className="space-y-6">
        <button className="text-sm text-blue-600 hover:underline" onClick={() => setActive(null)}>
          返回课程列表
        </button>
        <h2 className="text-2xl font-semibold text-slate-900">{active.bank.name}</h2>
        <PracticeBoard sessionId={active.sessionId} questions={active.questions} onFinished={() => setActive(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">课程列表</h1>
      <p className="text-sm text-slate-600">后台上传的官方题库会显示在这里，点击进入练习。</p>
      <div className="grid gap-4 md:grid-cols-2">
        {(banks ?? []).map(bank => (
          <div key={bank.id} className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800">{bank.name}</h3>
            <p className="mt-1 text-sm text-slate-500">等级范围：Tier {bank.levelMin} - {bank.levelMax}</p>
            <p className="mt-2 text-xs text-slate-500">{bank.description || "暂无简介。"}</p>
            <button
              type="button"
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-50"
              onClick={() => startPractice(bank)}
              disabled={!deviceId}
            >
              开始练习
            </button>
          </div>
        ))}
        {!banks?.length && <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">暂无课程。</div>}
      </div>
    </div>
  );
};
