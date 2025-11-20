import React, { useSyncExternalStore } from "react";
import { useAuth } from "../hooks/useAuth";

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

export interface UserStats {
  totalPlayTime: number;
  totalStars: number;
  completedStages: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: string;
}

export interface ProgressState {
  stages: Record<string, StageRecord>;
  daily: Record<string, DailyLog>;
  userStats?: UserStats;
  lastSyncAt?: string;
  isOnline: boolean;
}

interface StageCompletionPayload {
  stageId: string;
  courseId: string;
  stars: number;
  mode: LessonMode;
}

interface CloudStageProgress {
  stageId: string;
  courseId: string;
  bestStars: number;
  attempts: number;
  lastPlayedAt: string;
  modes?: LessonMode[];
}

type CloudDailyLog = DailyLog;

interface SyncQueueItem {
  id: string;
  type: "stage_completion";
  payload: StageCompletionPayload;
  timestamp: number;
  retryCount: number;
}

const STORAGE_KEY_BASE = "judada:progress:v1";
const SYNC_QUEUE_KEY_BASE = "judada:sync_queue:v1";

const getCurrentUserKey = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "anonymous";
    const u = JSON.parse(raw);
    return u?.id || u?.email || "anonymous";
  } catch {
    return "anonymous";
  }
};

const getQueueKeyForCurrentUser = () => `${SYNC_QUEUE_KEY_BASE}:${getCurrentUserKey()}`;
const getStateKeyForCurrentUser = () => `${STORAGE_KEY_BASE}:${getCurrentUserKey()}`;

let currentQueueKey: string | null = null;
let currentStateKey: string | null = null;

// ----------------- Local persistence -----------------

const loadState = (key: string = getStateKeyForCurrentUser()): ProgressState => {
  try {
    currentStateKey = key;
    const raw = window.localStorage.getItem(key);
    if (!raw) return { stages: {}, daily: {}, isOnline: navigator.onLine };
    const parsed = JSON.parse(raw) as ProgressState;
    return {
      stages: parsed.stages ?? {},
      daily: parsed.daily ?? {},
      userStats: parsed.userStats,
      lastSyncAt: parsed.lastSyncAt,
      isOnline: navigator.onLine
    };
  } catch {
    return { stages: {}, daily: {}, isOnline: navigator.onLine };
  }
};

const saveState = (state: ProgressState) => {
  try {
    const key = currentStateKey ?? getStateKeyForCurrentUser();
    currentStateKey = key;
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // ignore
  }
};

const loadSyncQueue = (): SyncQueueItem[] => {
  try {
    const key = getQueueKeyForCurrentUser();
    currentQueueKey = key;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveSyncQueue = (queue: SyncQueueItem[]) => {
  try {
    const key = currentQueueKey ?? getQueueKeyForCurrentUser();
    currentQueueKey = key;
    window.localStorage.setItem(key, JSON.stringify(queue));
  } catch {
    // ignore
  }
};

// ----------------- State & listeners -----------------

let state: ProgressState =
  typeof window === "undefined" ? { stages: {}, daily: {}, isOnline: false } : loadState();
let syncQueue: SyncQueueItem[] = typeof window === "undefined" ? [] : loadSyncQueue();

const ensureQueueLoaded = () => {
  const expectedKey = getQueueKeyForCurrentUser();
  if (currentQueueKey !== expectedKey) {
    syncQueue = loadSyncQueue();
  }
};

const ensureStateLoaded = () => {
  const expectedKey = getStateKeyForCurrentUser();
  if (currentStateKey !== expectedKey) {
    state = loadState(expectedKey);
    notify();
  }
};

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

const persistAll = () => {
  saveState(state);
  saveSyncQueue(syncQueue);
};

// ----------------- Network helpers -----------------

const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("未登录");
  const response = await fetch(`/api/user${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers
    },
    ...options
  });
  if (!response.ok) {
    throw new Error(`API 调用失败: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

// ----------------- Online/offline -----------------

const updateOnlineStatus = () => {
  const isOnline = navigator.onLine;
  if (state.isOnline !== isOnline) {
    state = { ...state, isOnline };
    persistAll();
    notify();
    if (isOnline && syncQueue.length > 0) {
      processSyncQueue();
    }
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
}

// ----------------- Cloud sync -----------------

const loadFromCloud = async (): Promise<boolean> => {
  try {
    ensureStateLoaded();
    const localStages = { ...state.stages };
    const localDaily = { ...state.daily };
    const response = await apiCall("/progress");
    if (response.success) {
      const { userProgress, userStats, userDailyLogs } = response.data;

      const remoteStageList: CloudStageProgress[] = Array.isArray(userProgress) ? userProgress : [];
      const stages: Record<string, StageRecord> = {};
      remoteStageList.forEach(progress => {
        stages[progress.stageId] = {
          stageId: progress.stageId,
          courseId: progress.courseId,
          bestStars: progress.bestStars,
          attempts: progress.attempts,
          lastPlayedAt: progress.lastPlayedAt,
          modes: progress.modes || []
        };
      });
      // merge local on top (max stars/attempts, newer lastPlayedAt, union modes)
      Object.values(localStages).forEach(local => {
        const remote = stages[local.stageId];
        if (!remote) {
          stages[local.stageId] = local;
          return;
        }
        stages[local.stageId] = {
          stageId: local.stageId,
          courseId: local.courseId || remote.courseId,
          bestStars: Math.max(remote.bestStars ?? 0, local.bestStars ?? 0),
          attempts: Math.max(remote.attempts ?? 0, local.attempts ?? 0),
          lastPlayedAt:
            new Date(local.lastPlayedAt) > new Date(remote.lastPlayedAt)
              ? local.lastPlayedAt
              : remote.lastPlayedAt,
          modes: Array.from(new Set([...(remote.modes || []), ...(local.modes || [])]))
        };
      });

      const remoteDailyLogs: CloudDailyLog[] = Array.isArray(userDailyLogs) ? userDailyLogs : [];
      const daily: Record<string, DailyLog> = {};
      remoteDailyLogs.forEach(log => {
        daily[log.date] = {
          date: log.date,
          completedStages: log.completedStages,
          starsEarned: log.starsEarned,
          typingStages: log.typingStages
        };
      });
      Object.values(localDaily).forEach(local => {
        const remote = daily[local.date];
        if (!remote) {
          daily[local.date] = local;
          return;
        }
        daily[local.date] = {
          date: local.date,
          completedStages: Math.max(local.completedStages, remote.completedStages),
          starsEarned: Math.max(local.starsEarned, remote.starsEarned),
          typingStages: Math.max(local.typingStages, remote.typingStages)
        };
      });

      state = {
        ...state,
        stages,
        daily,
        userStats: userStats
          ? {
              totalPlayTime: userStats.totalPlayTime,
              totalStars: userStats.totalStars,
              completedStages: userStats.completedStages,
              currentStreak: userStats.currentStreak,
              longestStreak: userStats.longestStreak,
              lastActiveAt: userStats.lastActiveAt
            }
          : undefined,
        lastSyncAt: new Date().toISOString(),
        isOnline: navigator.onLine
      };
      persistAll();
      console.log("云端进度加载成功，", Object.keys(stages).length, "个关卡");
      return true;
    }
  } catch (error) {
    console.error("云端进度加载失败", error);
  }
  return false;
};

const uploadStageProgress = async (payload: StageCompletionPayload): Promise<boolean> => {
  try {
    const response = await apiCall("/progress/stage", {
      method: "POST",
      body: JSON.stringify({
        stageId: payload.stageId,
        courseId: payload.courseId,
        bestStars: payload.stars,
        modes: [payload.mode]
      })
    });
    return response.success;
  } catch (error) {
    console.error("上传关卡进度失败:", error);
    return false;
  }
};

const batchSyncToCloud = async (progressItems: StageRecord[]): Promise<boolean> => {
  try {
    const progress = progressItems.map(item => ({
      stageId: item.stageId,
      courseId: item.courseId,
      bestStars: item.bestStars,
      modes: item.modes
    }));
    const response = await apiCall("/progress/sync", {
      method: "POST",
      body: JSON.stringify({ progress })
    });
    return response.success;
  } catch (error) {
    console.error("批量同步失败:", error);
    return false;
  }
};

const processSyncQueue = async () => {
  ensureQueueLoaded();
  if (!state.isOnline || syncQueue.length === 0) return;

  const queue = [...syncQueue];
  const failedItems: SyncQueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === "stage_completion") {
        const success = await uploadStageProgress(item.payload);
        if (!success) {
          item.retryCount++;
          if (item.retryCount < 3) failedItems.push(item);
        }
      }
    } catch (error) {
      console.error("同步队列请求失败", error);
      item.retryCount++;
      if (item.retryCount < 3) failedItems.push(item);
    }
  }

  syncQueue = failedItems;
  persistAll();

  if (syncQueue.length === 0) {
    state = { ...state, lastSyncAt: new Date().toISOString() };
    persistAll();
    notify();
  }
};

// ----------------- Public API -----------------

const getTodayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
};

const mergeModes = (existing: LessonMode[], next: LessonMode) => {
  if (existing.includes(next)) return existing;
  return [...existing, next];
};

const recordStageCompletion = ({ stageId, courseId, stars, mode }: StageCompletionPayload) => {
  ensureStateLoaded();
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
    ...state,
    stages: { ...state.stages, [stageId]: stageRecord },
    daily: { ...state.daily, [today]: nextDaily }
  };
  persistAll();

  const token = localStorage.getItem("token");
  if (token) {
    addToSyncQueue({ stageId, courseId, stars, mode });
  }

  notify();
};

const addToSyncQueue = (payload: StageCompletionPayload) => {
  const queueItem: SyncQueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    type: "stage_completion",
    payload,
    timestamp: Date.now(),
    retryCount: 0
  };
  syncQueue.push(queueItem);
  persistAll();
  if (state.isOnline) {
    processSyncQueue();
  }
};

const syncToCloud = async () => {
  ensureStateLoaded();
  if (!state.isOnline) {
    console.warn("离线状态，无法同步");
    return false;
  }
  const progressItems = Object.values(state.stages);
  if (progressItems.length === 0) return true;

  try {
    const success = await batchSyncToCloud(progressItems);
    if (success) {
      state = { ...state, lastSyncAt: new Date().toISOString() };
      persistAll();
      notify();
    }
    return success;
  } catch (error) {
    console.error("手动同步失败:", error);
    return false;
  }
};

const refreshFromCloud = async () => {
  ensureStateLoaded();
  if (!state.isOnline) {
    console.warn("离线状态，无法刷新");
    return false;
  }
  return await loadFromCloud();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getState = () => state;

const initializeForUser = async () => {
  ensureStateLoaded();
  if (!state.isOnline) {
    console.warn("离线状态，跳过云端初始化");
    return;
  }
  const loaded = await loadFromCloud();
  if (loaded) {
    await processSyncQueue();
  }
};

const cleanup = () => {
  state = { stages: {}, daily: {}, isOnline: navigator.onLine };
  syncQueue = [];
  currentStateKey = null;
  currentQueueKey = null;
  notify();
};

export const progressStore = {
  getState,
  subscribe,
  recordStageCompletion,
  syncToCloud,
  refreshFromCloud,
  initializeForUser,
  cleanup
};

export const useProgressStore = () => useSyncExternalStore(progressStore.subscribe, progressStore.getState);

export const getStageStars = (stageId: string) => state.stages[stageId]?.bestStars ?? 0;

export const getCourseStarSummary = (_courseId: string, stageIds: string[]) => {
  const totalStages = stageIds.length;
  const earnedStars = stageIds.reduce((sum, id) => sum + (state.stages[id]?.bestStars ?? 0), 0);
  const completedStages = stageIds.filter(id => state.stages[id]).length;
  return { totalStages, earnedStars, completedStages };
};

export const getTodayDailyLog = () => {
  const today = getTodayKey();
  return (
    state.daily[today] || {
      date: today,
      completedStages: 0,
      starsEarned: 0,
      typingStages: 0
    }
  );
};

export const getUserStats = () => state.userStats;

export const getSyncStatus = () => ({
  isOnline: state.isOnline,
  lastSyncAt: state.lastSyncAt,
  pendingSyncs: syncQueue.length
});

// 云同步 hook：登录后自动初始化并轮询
export const useCloudSync = () => {
  const { user, isLoading, isAuthenticated } = useAuth();

  React.useEffect(() => {
    if (isLoading) return;
    const token = localStorage.getItem("token");
    if (isAuthenticated && user && token) {
      progressStore.initializeForUser();
    } else {
      if (!token) {
        progressStore.cleanup();
      }
    }
  }, [user, isLoading, isAuthenticated]);

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && localStorage.getItem("token")) {
        progressStore.refreshFromCloud();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  React.useEffect(() => {
    if (isLoading) return;
    const token = localStorage.getItem("token");
    if (!(isAuthenticated && token)) return;

    const interval = window.setInterval(() => {
      if (document.hidden) return;
      const { isOnline, pendingSyncs } = getSyncStatus();
      if (!isOnline) return;
      if (pendingSyncs > 0) {
        progressStore.syncToCloud();
      } else {
        progressStore.refreshFromCloud();
      }
    }, 20000);

    return () => window.clearInterval(interval);
  }, [isAuthenticated, isLoading]);
};

// 每日任务（常量）
export const DAILY_TASKS = [
  {
    id: "play-2",
    title: "完成 2 个关卡",
    description: "任意模式通过两关",
    target: 2,
    metric: "completedStages" as const
  },
  {
    id: "earn-5-stars",
    title: "累计 5 颗星",
    description: "多拿星星提升成绩",
    target: 5,
    metric: "starsEarned" as const
  },
  {
    id: "typing-once",
    title: "键入模式 1 次",
    description: "尝试键入模式完成提交",
    target: 1,
    metric: "typingStages" as const
  }
];

export type DailyTaskMetric = (typeof DAILY_TASKS)[number]["metric"];
