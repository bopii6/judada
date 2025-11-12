import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api/client";
import type { QuestionBank, PlacementStartResponse, PlacementSubmitResponse } from "../api/types";
import { useDeviceId } from "../hooks/useDeviceId";
import { PlacementBoard } from "../components/PlacementBoard";

interface BanksResponse {
  banks: QuestionBank[];
}

const fetchBanks = async () => {
  const { data } = await api.get<BanksResponse>("/banks");
  return data.banks;
};

const fetchPlacementBanks = async () => {
  const { data } = await api.get<BanksResponse>("/placement/banks");
  return data.banks;
};

export const Dashboard = () => {
  const deviceId = useDeviceId();
  const { data: banks } = useQuery({ queryKey: ["banks"], queryFn: fetchBanks });
  const { data: placementBanks } = useQuery({ queryKey: ["placement-banks"], queryFn: fetchPlacementBanks });
  const [placementSession, setPlacementSession] = useState<PlacementStartResponse | null>(null);
  const [placementResult, setPlacementResult] = useState<PlacementSubmitResponse | null>(null);

  const startPlacement = async () => {
    if (!deviceId) return;
    const { data } = await api.post<PlacementStartResponse>("/placement/start", { deviceId });
    const normalized: PlacementStartResponse = {
      ...data,
      questions: data.questions.map(question => ({
        ...question,
        variants: Array.isArray(question.variants) ? question.variants : []
      }))
    };
    setPlacementSession(normalized);
    setPlacementResult(null);
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-slate-900">我的学习概况</h1>
        <p className="mt-2 text-sm text-slate-600">选择一个课程开始练习，或完成定位测获得推荐难度。</p>
        {placementResult && (
          <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">定位测结果</div>
            <div className="mt-1">得分：{placementResult.score.toFixed(1)} · 推荐 Tier {placementResult.recommendedTier}</div>
            <div className="mt-2 text-xs text-slate-500">
              推荐课程：{placementResult.recommendedBanks.map(bank => bank.name).join(', ') || '暂无匹配'}
            </div>
            <button className="mt-3 text-xs text-blue-600 hover:underline" onClick={() => setPlacementResult(null)}>
              隐藏结果
            </button>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">可选课程</h2>
          <p className="mt-1 text-xs text-slate-500">后台上传的所有普通题库。</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {(banks ?? []).map(bank => (
              <li key={bank.id} className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2">
                <div>
                  <div className="font-medium text-slate-800">{bank.name}</div>
                  <div className="text-xs text-slate-500">Tier {bank.levelMin} - {bank.levelMax}</div>
                </div>
              </li>
            ))}
            {!banks?.length && <li className="text-xs text-slate-500">暂无课程，请等待后台上传。</li>}
          </ul>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">定位测</h2>
          <p className="mt-1 text-xs text-slate-500">系统将从定位测题库中随机抽题。</p>
          {placementSession ? (
            <PlacementBoard
              sessionId={placementSession.sessionId}
              questions={placementSession.questions}
              onFinished={result => {
                setPlacementSession(null);
                setPlacementResult(result);
              }}
            />
          ) : (
            <button
              type="button"
              className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-600 disabled:opacity-50"
              onClick={startPlacement}
              disabled={!deviceId || !placementBanks?.length}
            >
              开始定位测
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
