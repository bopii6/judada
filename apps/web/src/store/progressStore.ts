import { useSyncExternalStore } from "react";

const STORAGE_KEY = "judada:progress:v1";

type LessonMode = "tiles" | "type";

export interface StageRecord {
  stageId: string;
  courseId: string;
  bestStars: number;
  attempts: number;
  lastPlayedAt: string;
  modes: LessonMode[];
}

export interface DailyLog {
  date: string;
  completedStages: number;
  starsEarned: number;
  typingStages: number;
}

export interface ProgressState {
  stages: Record<string, StageRecord>;
  daily: Record<string, DailyLog>;
}

interface StageCompletionPayload {
  stageId: string;
  courseId: string;
  stars: number;
  mode: LessonMode;
}

const loadState = (): ProgressState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { stages: {}, daily: {} };
    }
    const parsed = JSON.parse(raw) as ProgressState;
    return {
      stages: parsed.stages ?? {},
      daily: parsed.daily ?? {}
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Failed to load progress store", error);
    return { stages: {}, daily: {} };
  }
};

const saveState = (state: ProgressState) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Failed to persist progress store", error);
  }
};

let state: ProgressState =
  typeof window === "undefined" ? { stages: {}, daily: {} } : loadState();

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

const getTodayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const mergeModes = (existing: LessonMode[], next: LessonMode) => {
  if (existing.includes(next)) return existing;
  return [...existing, next];
};

const recordStageCompletion = ({ stageId, courseId, stars, mode }: StageCompletionPayload) => {
  if (typeof window === "undefined") return;
  const current = state.stages[stageId];
  const now = new Date().toISOString();

  const stageRecord: StageRecord = current
    ? {
        ...current,
        bestStars: Math.max(current.bestStars, stars),
        attempts: current.attempts + 1,
        lastPlayedAt: now,
        modes: mergeModes(current.modes, mode)
      }
    : {
        stageId,
        courseId,
        bestStars: stars,
        attempts: 1,
        lastPlayedAt: now,
        modes: [mode]
      };

  const today = getTodayKey();
  const todayLog = state.daily[today] ?? {
    date: today,
    completedStages: 0,
    starsEarned: 0,
    typingStages: 0
  };

  const nextDaily: DailyLog = {
    ...todayLog,
    completedStages: todayLog.completedStages + 1,
    starsEarned: todayLog.starsEarned + stars,
    typingStages: todayLog.typingStages + (mode === "type" ? 1 : 0)
  };

  state = {
    stages: { ...state.stages, [stageId]: stageRecord },
    daily: { ...state.daily, [today]: nextDaily }
  };
  saveState(state);
  notify();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getState = () => state;

export const progressStore = {
  getState,
  subscribe,
  recordStageCompletion
};

export const useProgressStore = () =>
  useSyncExternalStore(progressStore.subscribe, progressStore.getState);

export const getStageStars = (stageId: string) => state.stages[stageId]?.bestStars ?? 0;

export const getCourseStarSummary = (courseId: string, stageIds: string[]) => {
  const totalStages = stageIds.length;
  const earnedStars = stageIds.reduce((sum, id) => sum + (state.stages[id]?.bestStars ?? 0), 0);
  const completedStages = stageIds.filter(id => state.stages[id]).length;
  return { totalStages, earnedStars, completedStages };
};

export const getTodayDailyLog = () => {
  const today = getTodayKey();
  return state.daily[today] ?? {
    date: today,
    completedStages: 0,
    starsEarned: 0,
    typingStages: 0
  };
};

export const DAILY_TASKS = [
  {
    id: "play-2",
    title: "完成 2 个关卡",
    description: "任意模式都算一次通关",
    target: 2,
    metric: "completedStages" as const
  },
  {
    id: "earn-5-stars",
    title: "收集 5 颗星星",
    description: "多拿星星可以解锁奖励",
    target: 5,
    metric: "starsEarned" as const
  },
  {
    id: "typing-once",
    title: "挑战一次键入模式",
    description: "输入完整句子并提交",
    target: 1,
    metric: "typingStages" as const
  }
];

export type DailyTaskMetric = (typeof DAILY_TASKS)[number]["metric"];
