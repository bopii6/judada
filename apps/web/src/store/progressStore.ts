import React, { useSyncExternalStore } from "react";
import { useAuth } from "../hooks/useAuth";

const STORAGE_KEY = "judada:progress:v1";
const SYNC_QUEUE_KEY = "judada:sync_queue:v1";

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

interface SyncQueueItem {
  id: string;
  type: 'stage_completion';
  payload: StageCompletionPayload;
  timestamp: number;
  retryCount: number;
}

// API 调用函数
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('未登录');
  }

  const response = await fetch(`/api/user${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API调用失败: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

// 从本地存储加载状态
const loadState = (): ProgressState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { stages: {}, daily: {}, isOnline: navigator.onLine };
    }
    const parsed = JSON.parse(raw) as ProgressState;
    return {
      stages: parsed.stages ?? {},
      daily: parsed.daily ?? {},
      userStats: parsed.userStats,
      lastSyncAt: parsed.lastSyncAt,
      isOnline: navigator.onLine
    };
  } catch (error) {
    console.warn("Failed to load progress store", error);
    return { stages: {}, daily: {}, isOnline: navigator.onLine };
  }
};

// 保存状态到本地存储
const saveState = (state: ProgressState) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Failed to persist progress store", error);
  }
};

// 加载同步队列
const loadSyncQueue = (): SyncQueueItem[] => {
  try {
    const raw = window.localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("Failed to load sync queue", error);
    return [];
  }
};

// 保存同步队列
const saveSyncQueue = (queue: SyncQueueItem[]) => {
  try {
    window.localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn("Failed to save sync queue", error);
  }
};

// 全局状态
let state: ProgressState =
  typeof window === "undefined" ? { stages: {}, daily: {}, isOnline: false } : loadState();

let syncQueue: SyncQueueItem[] =
  typeof window === "undefined" ? [] : loadSyncQueue();

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

// 网络状态监听
const updateOnlineStatus = () => {
  const isOnline = navigator.onLine;
  if (state.isOnline !== isOnline) {
    state = { ...state, isOnline };
    saveState(state);
    notify();

    // 如果重新上线，尝试同步
    if (isOnline && syncQueue.length > 0) {
      processSyncQueue();
    }
  }
};

if (typeof window !== "undefined") {
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
}

// 从云端加载用户进度数据
const loadFromCloud = async (): Promise<boolean> => {
  try {
    const response = await apiCall('/progress');
    if (response.success) {
      const { userProgress, userStats, userDailyLogs } = response.data;

      // 转换云端数据格式为本地格式
      const stages: Record<string, StageRecord> = {};
      userProgress.forEach((progress: any) => {
        stages[progress.stageId] = {
          stageId: progress.stageId,
          courseId: progress.courseId,
          bestStars: progress.bestStars,
          attempts: progress.attempts,
          lastPlayedAt: progress.lastPlayedAt,
          modes: progress.modes || []
        };
      });

      const daily: Record<string, DailyLog> = {};
      userDailyLogs.forEach((log: any) => {
        daily[log.date] = {
          date: log.date,
          completedStages: log.completedStages,
          starsEarned: log.starsEarned,
          typingStages: log.typingStages
        };
      });

      state = {
        ...state,
        stages,
        daily,
        userStats: userStats ? {
          totalPlayTime: userStats.totalPlayTime,
          totalStars: userStats.totalStars,
          completedStages: userStats.completedStages,
          currentStreak: userStats.currentStreak,
          longestStreak: userStats.longestStreak,
          lastActiveAt: userStats.lastActiveAt
        } : undefined,
        lastSyncAt: new Date().toISOString(),
        isOnline: navigator.onLine
      };

      saveState(state);
      console.log('云端进度加载成功，共', Object.keys(stages).length, '个关卡');
      return true;
    }
  } catch (error) {
    console.error('从云端加载进度失败:', error);
  }
  return false;
};

// 上传单个关卡进度到云端
const uploadStageProgress = async (payload: StageCompletionPayload): Promise<boolean> => {
  try {
    const response = await apiCall('/progress/stage', {
      method: 'POST',
      body: JSON.stringify({
        stageId: payload.stageId,
        courseId: payload.courseId,
        bestStars: payload.stars,
        modes: [payload.mode]
      }),
    });

    return response.success;
  } catch (error) {
    console.error('上传关卡进度失败:', error);
    return false;
  }
};

// 批量同步进度到云端
const batchSyncToCloud = async (progressItems: StageRecord[]): Promise<boolean> => {
  try {
    const progress = progressItems.map(item => ({
      stageId: item.stageId,
      courseId: item.courseId,
      bestStars: item.bestStars,
      modes: item.modes
    }));

    const response = await apiCall('/progress/sync', {
      method: 'POST',
      body: JSON.stringify({ progress }),
    });

    return response.success;
  } catch (error) {
    console.error('批量同步进度失败:', error);
    return false;
  }
};

// 处理同步队列
const processSyncQueue = async () => {
  if (!state.isOnline || syncQueue.length === 0) return;

  const queue = [...syncQueue];
  const failedItems: SyncQueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'stage_completion') {
        const success = await uploadStageProgress(item.payload);
        if (!success) {
          item.retryCount++;
          if (item.retryCount < 3) {
            failedItems.push(item);
          }
        }
      }
    } catch (error) {
      console.error('同步队列项失败:', error);
      item.retryCount++;
      if (item.retryCount < 3) {
        failedItems.push(item);
      }
    }
  }

  syncQueue = failedItems;
  saveSyncQueue(syncQueue);

  // 如果队列处理完成，更新最后同步时间
  if (syncQueue.length === 0) {
    state = { ...state, lastSyncAt: new Date().toISOString() };
    saveState(state);
    notify();
  }
};

// 添加到同步队列
const addToSyncQueue = (payload: StageCompletionPayload) => {
  const queueItem: SyncQueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    type: 'stage_completion',
    payload,
    timestamp: Date.now(),
    retryCount: 0
  };

  syncQueue.push(queueItem);
  saveSyncQueue(syncQueue);

  // 如果在线，立即尝试同步
  if (state.isOnline) {
    processSyncQueue();
  }
};

// 获取今天的日期键
const getTodayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

// 合并游戏模式
const mergeModes = (existing: LessonMode[], next: LessonMode) => {
  if (existing.includes(next)) return existing;
  return [...existing, next];
};

// 记录关卡完成
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
    ...state,
    stages: { ...state.stages, [stageId]: stageRecord },
    daily: { ...state.daily, [today]: nextDaily }
  };

  saveState(state);

  // 如果已登录，添加到同步队列
  const token = localStorage.getItem('token');
  if (token) {
    addToSyncQueue({ stageId, courseId, stars, mode });
  }

  notify();
};

// 手动同步
const syncToCloud = async () => {
  if (!state.isOnline) {
    console.warn('离线状态，无法同步');
    return false;
  }

  const progressItems = Object.values(state.stages);
  if (progressItems.length === 0) {
    return true;
  }

  try {
    const success = await batchSyncToCloud(progressItems);
    if (success) {
      state = { ...state, lastSyncAt: new Date().toISOString() };
      saveState(state);
      notify();
    }
    return success;
  } catch (error) {
    console.error('手动同步失败:', error);
    return false;
  }
};

// 从云端刷新数据
const refreshFromCloud = async () => {
  if (!state.isOnline) {
    console.warn('离线状态，无法刷新');
    return false;
  }

  console.log('强制从云端刷新数据...');
  return await loadFromCloud();
};

// 订阅状态变化
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// 获取当前状态
const getState = () => state;

// 初始化函数 - 在用户登录后调用
const initializeForUser = async () => {
  if (!state.isOnline) {
    console.warn('离线状态，跳过云端加载');
    return;
  }

  // 每次初始化都强制从云端刷新数据
  console.log('初始化云同步，开始从云端加载数据...');
  const loaded = await loadFromCloud();
  if (loaded) {
    // 云端数据加载成功，处理同步队列
    await processSyncQueue();
  } else {
    console.warn('云端数据加载失败，使用本地数据');
  }
};

// 清理函数 - 在用户登出时调用
const cleanup = () => {
  state = { stages: {}, daily: {}, isOnline: navigator.onLine };
  syncQueue = [];
  saveState(state);
  saveSyncQueue(syncQueue);
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

// React Hook
export const useProgressStore = () =>
  useSyncExternalStore(progressStore.subscribe, progressStore.getState);

// 辅助函数
export const getStageStars = (stageId: string) => state.stages[stageId]?.bestStars ?? 0;

export const getCourseStarSummary = (_courseId: string, stageIds: string[]) => {
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

export const getUserStats = () => state.userStats;

export const getSyncStatus = () => ({
  isOnline: state.isOnline,
  lastSyncAt: state.lastSyncAt,
  pendingSyncs: syncQueue.length
});

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

// 云同步初始化Hook
export const useCloudSync = () => {
  const { user, isLoading, isAuthenticated } = useAuth();

  React.useEffect(() => {
    // 避免在鉴权尚未完成时误触发清理，导致本地进度被清空
    if (isLoading) return;

    const token = localStorage.getItem('token');

    if (isAuthenticated && user && token) {
      // 已通过鉴权（邮箱或游客），初始化云同步
      progressStore.initializeForUser();
    } else {
      // 仅在明确没有 token（已登出）时清理本地进度
      if (!token) {
        progressStore.cleanup();
      }
    }
  }, [user, isLoading, isAuthenticated]);

  // 监听页面可见性变化，当页面重新获得焦点时尝试同步
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && localStorage.getItem('token')) {
        // 页面重新可见，尝试从云端刷新数据
        progressStore.refreshFromCloud();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 轻量轮询：在线且已登录时，每20秒拉取一次云端数据；若有待同步则先推送
  React.useEffect(() => {
    if (isLoading) return;
    const token = localStorage.getItem('token');
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

    return () => {
      window.clearInterval(interval);
    };
  }, [isAuthenticated, isLoading]);
};
