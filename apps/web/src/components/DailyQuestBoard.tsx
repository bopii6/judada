import { DAILY_TASKS, getTodayDailyLog, useProgressStore } from "../store/progressStore";
import { CheckCircle2, Circle, Trophy } from "lucide-react";

export const DailyQuestBoard = () => {
  useProgressStore(); // subscribe for updates
  const today = getTodayDailyLog();

  return (
    <section className="rounded-[2rem] bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-500">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">每日挑战</h2>
            <p className="text-sm text-slate-500 font-medium">完成任务，赢取今日徽章</p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-500">
          {today.date}
        </span>
      </div>

      <div className="grid gap-4">
        {DAILY_TASKS.map(task => {
          const progress = today[task.metric] as number;
          const ratio = Math.min(progress / task.target, 1);
          const completed = ratio >= 1;

          return (
            <div
              key={task.id}
              className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${completed
                  ? "border-emerald-100 bg-emerald-50/50"
                  : "border-slate-100 bg-white hover:border-indigo-100 hover:shadow-sm"
                }`}
            >
              {/* Progress Bar Background */}
              <div
                className={`absolute bottom-0 left-0 top-0 bg-emerald-100/30 transition-all duration-500 ease-out ${completed ? 'opacity-0' : 'opacity-100'}`}
                style={{ width: `${ratio * 100}%` }}
              />

              <div className="relative flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className={`rounded-full p-1 ${completed ? "text-emerald-500" : "text-slate-300"}`}>
                    {completed ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className={`text-base font-bold ${completed ? "text-emerald-700" : "text-slate-700"}`}>
                      {task.title}
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{task.description}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-sm font-bold font-mono ${completed ? "text-emerald-600" : "text-indigo-500"}`}>
                    {Math.min(progress, task.target)}
                    <span className="text-slate-400 mx-1">/</span>
                    {task.target}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
