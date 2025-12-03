import React from "react";
import { SyncStatus } from "../components/SyncStatus";
import { StudentProfileHero } from "../components/dashboard/StudentProfileHero";
import { LearningTimeline } from "../components/dashboard/LearningTimeline";
import { WeeklyReportCard } from "../components/dashboard/WeeklyReportCard";

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 px-4 sm:px-6 lg:px-8">
      <SyncStatus />

      {/* Hero Section */}
      <StudentProfileHero />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Supervision (Timeline) */}
        <div className="lg:col-span-2 space-y-8">
          <LearningTimeline />
        </div>

        {/* Right Column: Social/Report */}
        <div className="lg:col-span-1 space-y-8">
          <WeeklyReportCard />

          {/* Placeholder for future "Curriculum Progress" or other widgets */}
          {/* <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 h-64 flex items-center justify-center text-slate-400 font-bold border-dashed">
            更多功能敬请期待
          </div> */}
        </div>
      </div>
    </div>
  );
};
