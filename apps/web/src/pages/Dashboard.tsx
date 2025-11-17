import React, { useMemo } from "react";
import { useDeviceId } from "../hooks/useDeviceId";
import { DailyQuestBoard } from "../components/DailyQuestBoard";
import { useProgressStore } from "../store/progressStore";
import { SyncStatus } from "../components/SyncStatus";

export const Dashboard: React.FC = () => {
  const deviceId = useDeviceId();
  const progress = useProgressStore();

  const progressSummary = useMemo(() => {
    const records = Object.values(progress.stages);
    const totalStars = records.reduce((sum, record) => sum + record.bestStars, 0);
    const totalStages = records.length;
    return { totalStars, totalStages };
  }, [progress]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 顶部同步组件（已隐藏内容，仅占位保持布局稳定） */}
      <SyncStatus />

      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">我的学习概况</h1>
            <p className="mt-1 sm:mt-2 text-sm text-slate-600">继续向前推进，完成每日任务解锁更多奖励。</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">累计完成关卡</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{progressSummary.totalStages}</p>
              </div>
              <div className="text-3xl">🏆</div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">获得星星</p>
                <p className="mt-1 text-2xl font-semibold text-amber-500">{progressSummary.totalStars}</p>
              </div>
              <div className="text-3xl">⭐</div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs text-slate-500">设备 ID</p>
                <p className="mt-1 text-sm font-mono text-slate-700 break-all">{deviceId ?? "加载中..."}</p>
              </div>
              <div className="text-3xl ml-3">📱</div>
            </div>
          </div>
        </div>
      </section>

      <DailyQuestBoard />

      {/* 可选课程与定位测模块已移除 */}
    </div>
  );
};

export default Dashboard;

