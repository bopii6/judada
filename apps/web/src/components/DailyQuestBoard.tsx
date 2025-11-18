import { DAILY_TASKS, getTodayDailyLog, useProgressStore } from "../store/progressStore";

export const DailyQuestBoard = () => {
  useProgressStore(); // subscribe for updates
  const today = getTodayDailyLog();

  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">每日任务</p>
          <h2 className="text-xl font-semibold text-slate-900">完成小目标拿奖励</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{today.date}</span>
      </div>
      <ul className="mt-4 space-y-3">
        {DAILY_TASKS.map(task => {
          const progress = today[task.metric] as number;
          const ratio = Math.min(progress / task.target, 1);
          const completed = ratio >= 1;
          return (
            <li
              key={task.id}
              className={`rounded-2xl border px-4 py-3 transition ${
                completed ? "border-emerald-200 bg-emerald-50" : "border-slate-200/80 bg-white/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{task.title}</p>
                  <p className="text-xs text-slate-500">{task.description}</p>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  {Math.min(progress, task.target)} / {task.target}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${completed ? "bg-emerald-400" : "bg-indigo-400"}`}
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
              {completed && <p className="mt-1 text-xs text-emerald-600">已完成！记得领取贴纸奖励 👏</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
