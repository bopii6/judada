import fs from 'node:fs';
import path from 'node:path';

type LessonMode = 'tiles' | 'type';

export interface StageRecord {
  id?: string;
  userId: string;
  stageId: string;
  courseId: string;
  bestStars: number; // 0-3
  attempts: number;
  lastPlayedAt: string; // ISO
  modes: LessonMode[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserStats {
  userId: string;
  totalPlayTime: number;
  totalStars: number;
  completedStages: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLog {
  userId: string;
  date: string; // YYYY-MM-DD
  completedStages: number;
  starsEarned: number;
  typingStages: number;
  createdAt: string;
  updatedAt: string;
}

interface StoreShape {
  progress: Record<string, StageRecord[]>; // by userId
  stats: Record<string, UserStats>; // by userId
  daily: Record<string, DailyLog[]>; // by userId
}

const dataDir = path.resolve(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'local-progress.json');

function ensureDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function load(): StoreShape {
  try {
    ensureDir();
    if (!fs.existsSync(dataFile)) {
      return { progress: {}, stats: {}, daily: {} };
    }
    const raw = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { progress: {}, stats: {}, daily: {} };
  }
}

function save(store: StoreShape) {
  try {
    ensureDir();
    fs.writeFileSync(dataFile, JSON.stringify(store, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

const store: StoreShape = load();

const nowIso = () => new Date().toISOString();
const todayKey = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

function getUserArrays(userId: string) {
  if (!store.progress[userId]) store.progress[userId] = [];
  if (!store.daily[userId]) store.daily[userId] = [];
  if (!store.stats[userId]) {
    const ts = nowIso();
    store.stats[userId] = {
      userId,
      totalPlayTime: 0,
      totalStars: 0,
      completedStages: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveAt: ts,
      createdAt: ts,
      updatedAt: ts,
    };
  }
  return {
    progress: store.progress[userId],
    daily: store.daily[userId],
    stats: store.stats[userId],
  };
}

export function getUserAll(userId: string) {
  const { progress, daily, stats } = getUserArrays(userId);
  return {
    userProgress: progress,
    userDailyLogs: daily,
    userStats: stats,
    userAchievements: [] as any[],
  };
}

export function hasAnyData(userId: string) {
  const p = store.progress[userId];
  const d = store.daily[userId];
  const s = store.stats[userId];
  return Boolean((p && p.length) || (d && d.length) || s);
}

export function clearUser(userId: string) {
  delete store.progress[userId];
  delete store.daily[userId];
  delete store.stats[userId];
  save(store);
}

export function legacyEmailUserKeys() {
  return Object.keys(store.progress).filter(k => k.startsWith('email-user-'));
}

export function migrateLegacyKeysTo(canonicalUserId: string) {
  const keys = legacyEmailUserKeys();
  if (!keys.length) return false;
  let migrated = false;
  for (const k of keys) {
    // move progress
    const prog = store.progress[k];
    if (prog && prog.length) {
      const target = store.progress[canonicalUserId] || [];
      const existing = new Map(target.map(p => [p.stageId, p]));
      for (const item of prog) {
        const found = existing.get(item.stageId);
        if (found) {
          found.bestStars = Math.max(found.bestStars, item.bestStars);
          found.attempts += item.attempts;
          found.lastPlayedAt = item.lastPlayedAt > found.lastPlayedAt ? item.lastPlayedAt : found.lastPlayedAt;
          for (const m of item.modes) if (!found.modes.includes(m)) found.modes.push(m);
        } else {
          target.push({ ...item, userId: canonicalUserId });
        }
      }
      store.progress[canonicalUserId] = target;
      delete store.progress[k];
      migrated = true;
    }

    // move daily
    const daily = store.daily[k];
    if (daily && daily.length) {
      const target = store.daily[canonicalUserId] || [];
      const byDate = new Map(target.map(d => [d.date, d]));
      for (const log of daily) {
        const ex = byDate.get(log.date);
        if (ex) {
          ex.completedStages += log.completedStages;
          ex.starsEarned += log.starsEarned;
          ex.typingStages += log.typingStages;
          ex.updatedAt = nowIso();
        } else {
          target.push({ ...log, userId: canonicalUserId });
        }
      }
      store.daily[canonicalUserId] = target;
      delete store.daily[k];
      migrated = true;
    }

    // drop legacy stats, canonical will be recomputed on upsert/get
    if (store.stats[k]) {
      delete store.stats[k];
      migrated = true;
    }
  }
  if (migrated) save(store);
  return migrated;
}

export function upsertStage(userId: string, input: Omit<StageRecord, 'userId' | 'attempts' | 'lastPlayedAt' | 'createdAt' | 'updatedAt'> & { bestStars: number; modes: LessonMode[] }) {
  const { progress, stats } = getUserArrays(userId);
  const existing = progress.find(p => p.stageId === input.stageId);
  const ts = nowIso();
  if (existing) {
    existing.bestStars = Math.max(existing.bestStars, input.bestStars);
    existing.attempts += 1;
    existing.lastPlayedAt = ts;
    for (const m of input.modes) if (!existing.modes.includes(m)) existing.modes.push(m);
    existing.updatedAt = ts;
  } else {
    progress.push({
      userId,
      stageId: input.stageId,
      courseId: input.courseId,
      bestStars: input.bestStars,
      attempts: 1,
      lastPlayedAt: ts,
      modes: [...input.modes],
      createdAt: ts,
      updatedAt: ts,
    });
  }
  // update stats basics
  stats.totalStars = Math.max(0, progress.reduce((s, p) => s + p.bestStars, 0));
  stats.completedStages = progress.length;
  stats.lastActiveAt = ts;
  stats.updatedAt = ts;
  save(store);
}

export function batchUpsert(userId: string, items: { stageId: string; courseId: string; bestStars: number; modes: LessonMode[] }[]) {
  for (const it of items) {
    upsertStage(userId, it);
  }
}

export function updateDaily(userId: string, starsEarned: number, typingStages: number) {
  const { daily } = getUserArrays(userId);
  const ts = nowIso();
  const key = todayKey();
  let log = daily.find(d => d.date === key);
  if (!log) {
    log = {
      userId,
      date: key,
      completedStages: 0,
      starsEarned: 0,
      typingStages: 0,
      createdAt: ts,
      updatedAt: ts,
    };
    daily.push(log);
  }
  if (starsEarned > 0) log.completedStages += 1;
  log.starsEarned += Math.max(0, starsEarned);
  log.typingStages += Math.max(0, typingStages);
  log.updatedAt = ts;
  save(store);
}

export function getStats(userId: string) {
  const { stats } = getUserArrays(userId);
  return stats;
}
