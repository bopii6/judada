import { Router } from 'express';
import { getPrisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import * as localStore from '../lib/localProgressStore';

const router = Router();

// Schemas
const userProgressSchema = z.object({
  stageId: z.string(),
  courseId: z.string(),
  bestStars: z.number().min(0).max(3),
  modes: z.array(z.enum(['tiles', 'type']))
});

const userStatsSchema = z.object({
  totalPlayTime: z.number().min(0),
  totalStars: z.number().min(0),
  completedStages: z.number().min(0),
  currentStreak: z.number().min(0),
  longestStreak: z.number().min(0)
});

// Canonicalize user id: prefer email-based stable id if present
function canonicalUserId(user: { id: string; email?: string }) {
  if (user.email) {
    const emailLower = user.email.toLowerCase();
    const base64 = Buffer.from(emailLower).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    return `email-${base64}`;
  }
  return user.id;
}

// GET /progress - returns all user progress, stats, daily logs, achievements
router.get('/progress', authenticateToken, async (req, res) => {
  const userId = canonicalUserId(req.user!);
  try {
    const prisma = getPrisma();
    const [userProgress, userStats, userDailyLogs, userAchievements] = await Promise.all([
      prisma.$queryRaw`SELECT * FROM "UserProgress" WHERE "userId" = ${userId} ORDER BY "lastPlayedAt" DESC`,
      prisma.$queryRawFirst`SELECT * FROM "UserStats" WHERE "userId" = ${userId}`,
      prisma.$queryRaw`SELECT * FROM "UserDailyLog" WHERE "userId" = ${userId} ORDER BY "date" DESC LIMIT 30`,
      prisma.$queryRaw`SELECT * FROM "UserAchievement" WHERE "userId" = ${userId} ORDER BY "unlockedAt" DESC`,
    ]);

    // 如果数据库没有记录，但本地降级存储里有，优先返回本地数据，确保跨浏览器可见
    // 若本地存在 legacy "email-user-*" 数据，尝试迁移到规范的 email-base64 id
    if (!localStore.hasAnyData(userId)) {
      localStore.migrateLegacyKeysTo(userId);
    }
    const localData = localStore.getUserAll(userId);
    const useLocal = (!userProgress || (Array.isArray(userProgress) && userProgress.length === 0))
      && (localData.userProgress && localData.userProgress.length > 0);

    if (useLocal) {
      return res.json({ success: true, data: localData });
    }

    return res.json({
      success: true,
      data: {
        userProgress: userProgress || [],
        userStats: userStats || null,
        userDailyLogs: userDailyLogs || [],
        userAchievements: userAchievements || []
      }
    });
  } catch {
    // Fallback: local JSON store
    const data = localStore.getUserAll(userId);
    return res.json({ success: true, data });
  }
});

// POST /progress/stage - upsert single stage
router.post('/progress/stage', authenticateToken, async (req, res) => {
  const userId = canonicalUserId(req.user!);
  const { stageId, courseId, bestStars, modes } = userProgressSchema.parse(req.body);
  try {
    const prisma = getPrisma();

    const existing = await prisma.$queryRawFirst`SELECT * FROM "UserProgress" WHERE "userId" = ${userId} AND "stageId" = ${stageId}`;
    let result;
    if (existing) {
      result = await prisma.$queryRaw`
        UPDATE "UserProgress"
        SET "bestStars" = GREATEST("bestStars", ${bestStars}),
            "attempts" = "attempts" + 1,
            "lastPlayedAt" = CURRENT_TIMESTAMP,
            "modes" = ${modes},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = ${userId} AND "stageId" = ${stageId}
        RETURNING *
      `;
    } else {
      result = await prisma.$queryRaw`
        INSERT INTO "UserProgress"
        ("id", "userId", "stageId", "courseId", "bestStars", "attempts", "lastPlayedAt", "modes", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${userId},
          ${stageId},
          ${courseId},
          ${bestStars},
          1,
          CURRENT_TIMESTAMP,
          ${modes},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        RETURNING *
      `;
    }

    // 成功写入数据库后，也写入本地降级存储，保持两端一致
    localStore.upsertStage(userId, { stageId, courseId, bestStars, modes });
    await updateUserStats(userId, bestStars);
    await updateDailyLog(userId, bestStars, modes.includes('type') ? 1 : 0);
    await checkAchievements(userId, bestStars);
    return res.json({ success: true, data: result[0] || result });
  } catch {
    localStore.upsertStage(userId, { stageId, courseId, bestStars, modes });
    localStore.updateDaily(userId, bestStars, modes.includes('type') ? 1 : 0);
    const data = localStore.getUserAll(userId);
    const stage = data.userProgress.find(p => p.stageId === stageId);
    return res.json({ success: true, data: stage });
  }
});

// POST /progress/sync - batch upsert
router.post('/progress/sync', authenticateToken, async (req, res) => {
  const userId = canonicalUserId(req.user!);
  const { progress } = z.object({ progress: z.array(userProgressSchema) }).parse(req.body);
  try {
    const prisma = getPrisma();
    const results: any[] = [];
    for (const p of progress) {
      const result = await prisma.$queryRaw`
        INSERT INTO "UserProgress"
        ("id", "userId", "stageId", "courseId", "bestStars", "attempts", "lastPlayedAt", "modes", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${userId},
          ${p.stageId},
          ${p.courseId},
          ${p.bestStars},
          1,
          CURRENT_TIMESTAMP,
          ${p.modes},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("userId", "stageId")
        DO UPDATE SET
          "bestStars" = GREATEST("UserProgress"."bestStars", EXCLUDED."bestStars"),
          "lastPlayedAt" = CURRENT_TIMESTAMP,
          "modes" = EXCLUDED."modes",
          "updatedAt" = CURRENT_TIMESTAMP
        RETURNING *
      `;
      results.push(result[0] || result);
    }
    // 同步成功后，更新本地降级存储
    localStore.batchUpsert(userId, progress.map(p => ({ stageId: p.stageId, courseId: p.courseId, bestStars: p.bestStars, modes: p.modes })));
    const totalStars = progress.reduce((s, p) => s + p.bestStars, 0);
    await updateUserStats(userId, totalStars);
    return res.json({ success: true, data: results });
  } catch {
    localStore.batchUpsert(userId, progress.map(p => ({ stageId: p.stageId, courseId: p.courseId, bestStars: p.bestStars, modes: p.modes })));
    const data = localStore.getUserAll(userId);
    return res.json({ success: true, data: data.userProgress });
  }
});

// GET /stats
router.get('/stats', authenticateToken, async (req, res) => {
  const userId = canonicalUserId(req.user!);
  try {
    const prisma = getPrisma();
    let userStats = await prisma.$queryRawFirst`SELECT * FROM "UserStats" WHERE "userId" = ${userId}`;
    if (!userStats) {
      userStats = await prisma.$queryRaw`
        INSERT INTO "UserStats"
        ("id", "userId", "totalPlayTime", "totalStars", "completedStages", "currentStreak", "longestStreak", "lastActiveAt", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${userId},
          0, 0, 0, 0, 0,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        RETURNING *
      `;
    }
    return res.json({ success: true, data: userStats[0] || userStats });
  } catch {
    const stats = localStore.getStats(userId);
    return res.json({ success: true, data: stats });
  }
});

// POST /stats
router.post('/stats', authenticateToken, async (req, res) => {
  const userId = canonicalUserId(req.user!);
  const statsData = userStatsSchema.parse(req.body);
  try {
    const prisma = getPrisma();
    const userStats = await prisma.$queryRaw`
      INSERT INTO "UserStats"
      ("id", "userId", "totalPlayTime", "totalStars", "completedStages", "currentStreak", "longestStreak", "lastActiveAt", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${userId},
        ${statsData.totalPlayTime},
        ${statsData.totalStars},
        ${statsData.completedStages},
        ${statsData.currentStreak},
        ${statsData.longestStreak},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("userId")
      DO UPDATE SET
        "totalPlayTime" = EXCLUDED."totalPlayTime",
        "totalStars" = EXCLUDED."totalStars",
        "completedStages" = EXCLUDED."completedStages",
        "currentStreak" = EXCLUDED."currentStreak",
        "longestStreak" = EXCLUDED."longestStreak",
        "lastActiveAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *
    `;
    return res.json({ success: true, data: userStats[0] || userStats });
  } catch {
    // For local fallback, stats are recalculated from progress; just return current
    const stats = localStore.getStats(userId);
    return res.json({ success: true, data: stats });
  }
});

// Helpers with DB-first, fallback handled by callers
async function updateUserStats(userId: string, additionalStars: number) {
  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`
      INSERT INTO "UserStats"
      ("id", "userId", "totalPlayTime", "totalStars", "completedStages", "currentStreak", "longestStreak", "lastActiveAt", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${userId},
        0,
        ${Math.max(0, additionalStars)},
        ${additionalStars > 0 ? 1 : 0},
        0,
        0,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("userId")
      DO UPDATE SET
        "totalStars" = "UserStats"."totalStars" + ${Math.max(0, additionalStars)},
        "completedStages" = "UserStats"."completedStages" + CASE WHEN ${additionalStars} > 0 THEN 1 ELSE 0 END,
        "lastActiveAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    `;
  } catch {
    // stats are recalculated via local upserts; no-op here
  }
}

async function updateDailyLog(userId: string, starsEarned: number, typingStages: number) {
  try {
    const prisma = getPrisma();
    const today = new Date().toISOString().split('T')[0];
    await prisma.$queryRaw`
      INSERT INTO "UserDailyLog"
      ("id", "userId", "date", "completedStages", "starsEarned", "typingStages", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${userId},
        ${today},
        ${starsEarned > 0 ? 1 : 0},
        ${Math.max(0, starsEarned)},
        ${typingStages},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("userId", "date")
      DO UPDATE SET
        "completedStages" = "UserDailyLog"."completedStages" + CASE WHEN ${starsEarned} > 0 THEN 1 ELSE 0 END,
        "starsEarned" = "UserDailyLog"."starsEarned" + ${Math.max(0, starsEarned)},
        "typingStages" = "UserDailyLog"."typingStages" + ${typingStages},
        "updatedAt" = CURRENT_TIMESTAMP
    `;
  } catch {
    localStore.updateDaily(userId, starsEarned, typingStages);
  }
}

async function checkAchievements(userId: string, starsEarned: number) {
  try {
    const prisma = getPrisma();
    if (starsEarned > 0) {
      const firstCompletion = await prisma.$queryRawFirst`SELECT * FROM "UserAchievement" WHERE "userId" = ${userId} AND "type" = 'first_completion'`;
      if (!firstCompletion) {
        await prisma.$queryRaw`
          INSERT INTO "UserAchievement" ("id", "userId", "type", "data", "unlockedAt")
          VALUES (
            gen_random_uuid(),
            ${userId},
            'first_completion',
            '{"starsEarned": ' || ${starsEarned} || '}',
            CURRENT_TIMESTAMP
          )
        `;
      }
    }
    if (starsEarned === 3) {
      const perfectScore = await prisma.$queryRawFirst`SELECT * FROM "UserAchievement" WHERE "userId" = ${userId} AND "type" = 'perfect_score'`;
      if (!perfectScore) {
        await prisma.$queryRaw`
          INSERT INTO "UserAchievement" ("id", "userId", "type", "data", "unlockedAt")
          VALUES (
            gen_random_uuid(),
            ${userId},
            'perfect_score',
            '{"achievedAt": "' + ${new Date().toISOString()} + '"}',
            CURRENT_TIMESTAMP
          )
        `;
      }
    }
  } catch {
    // Ignore in fallback mode
  }
}

export default router;
