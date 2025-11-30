import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Star, Share2, Copy, ArrowLeft } from "lucide-react";
import { fetchCourseContent } from "../api/courses";

interface ShareLocationState {
  courseTitle?: string;
  stageCount?: number;
  elapsedSeconds?: number;
  stars?: number;
  comboStreak?: number;
}

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return "神速完成";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
};

export const SharePage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const shareState = (location.state ?? {}) as ShareLocationState;
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["course-content-share", courseId],
    queryFn: () => fetchCourseContent(courseId!),
    enabled: Boolean(courseId)
  });

  const courseTitle = shareState.courseTitle ?? data?.course?.title ?? "教材闯关";
  const stageTotal = shareState.stageCount ?? data?.course?.stageCount ?? data?.stages.length ?? 0;
  const elapsedSeconds = shareState.elapsedSeconds ?? 0;
  const stars = shareState.stars ?? 3;
  const comboStreak = shareState.comboStreak ?? stageTotal;

  const comboMessage = useMemo(() => {
    if (!comboStreak) return "轻松搞定每一关";
    if (comboStreak > stageTotal * 0.8) return "满贯王者 · 全程零失误";
    if (comboStreak > stageTotal / 2) return `超级连击 · ${comboStreak} Combo`;
    return "持续进步 · 掌握核心单词";
  }, [comboStreak, stageTotal]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyHint("分享链接已复制，快去朋友圈炫耀吧！");
      setTimeout(() => setCopyHint(null), 3000);
    } catch {
      setCopyHint("复制失败，请手动复制浏览器地址栏");
    }
  };

  const handleBack = () => {
    if (courseId) {
      navigate(`/courses/${courseId}`);
    } else {
      navigate("/courses");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF9F0] via-[#FCEFF2] to-[#E7F3FF] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white/80 backdrop-blur-xl rounded-[40px] border border-white/80 shadow-2xl shadow-[#FFB9C4]/20 overflow-hidden">
        <div className="flex justify-between items-center px-8 py-6 border-b border-white/70 bg-white/60">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
            返回课程
          </button>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-300 font-black">
            分享成就
          </p>
        </div>

        <div className="relative px-8 py-12 flex flex-col items-center text-center bg-gradient-to-br from-[#FDE68A]/60 via-[#FEC6A1]/70 to-[#DDD6FE]/50">
          <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.6),_transparent_60%)]" />
          <div className="relative z-10 flex flex-col items-center gap-3 mb-6">
            <div className="w-24 h-24 rounded-full bg-white/90 flex items-center justify-center shadow-lg shadow-orange-200/40">
              <Trophy className="w-12 h-12 text-yellow-500" />
            </div>
            <p className="text-xs font-semibold tracking-[0.8em] text-slate-400 uppercase">Mission Complete</p>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900">{courseTitle}</h1>
            <p className="text-sm font-semibold text-indigo-500 tracking-[0.4em] uppercase">
              {stageTotal} 个练习 · {formatDuration(elapsedSeconds)}
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            <div className="rounded-2xl bg-white/80 py-5 px-6 text-left border border-white/80 shadow-md shadow-orange-100/40">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.3em] mb-2">连击</p>
              <p className="text-3xl font-black text-slate-800">{comboStreak || stageTotal}</p>
              <p className="text-sm text-slate-500 mt-1">{comboMessage}</p>
            </div>
            <div className="rounded-2xl bg-white/80 py-5 px-6 text-left border border-white/80 shadow-md shadow-indigo-100/50">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.3em] mb-2">星级</p>
              <div className="flex items-center gap-2 text-yellow-400">
                {[...Array(3)].map((_, idx) => (
                  <Star
                    key={String(idx)}
                    className={idx < stars ? "w-6 h-6 fill-current" : "w-6 h-6 text-yellow-200"}
                  />
                ))}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {stars === 3 ? "全程满分表现" : stars === 2 ? "中高难度掌握" : "坚持到底最难得"}
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 py-5 px-6 text-left border border-white/80 shadow-md shadow-pink-100/50">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.3em] mb-2">速度</p>
              <p className="text-3xl font-black text-slate-800">{formatDuration(elapsedSeconds)}</p>
              <p className="text-sm text-slate-500 mt-1">保持这样的节奏，我们直奔冠军</p>
            </div>
          </div>

          <div className="relative z-10 mt-10 flex flex-col sm:flex-row gap-4 w-full">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 rounded-2xl bg-slate-900 text-white font-bold py-4 flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20"
            >
              <Copy className="w-4 h-4" />
              复制分享链接
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 rounded-2xl border-2 border-slate-900 text-slate-900 font-bold py-4 flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              保存成就卡
            </button>
          </div>

          {copyHint && <p className="relative z-10 mt-4 text-sm font-semibold text-slate-600">{copyHint}</p>}
        </div>
      </div>
    </div>
  );
};
