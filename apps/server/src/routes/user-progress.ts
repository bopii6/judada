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
    const [userProgress, userStatsRows, userDailyLogs, userAchievements] = await Promise.all([
      prisma.$queryRaw`SELECT * FROM "UserProgress" WHERE "userId" = ${userId} ORDER BY "lastPlayedAt" DESC`,
      prisma.$queryRaw`SELECT * FROM "UserStats" WHERE "userId" = ${userId} LIMIT 1`,
      prisma.$queryRaw`SELECT * FROM "UserDailyLog" WHERE "userId" = ${userId} ORDER BY "date" DESC LIMIT 30`,
      prisma.$queryRaw`SELECT * FROM "UserAchievement" WHERE "userId" = ${userId} ORDER BY "unlockedAt" DESC`,
    ]);
    const userStats = (userStatsRows as any[])[0] ?? null;

    // 濡傛灉鏁版嵁搴撴病鏈夎褰曪紝浣嗘湰鍦伴檷绾у瓨鍌ㄩ噷鏈夛紝浼樺厛杩斿洖鏈湴鏁版嵁锛岀‘淇濊法娴忚鍣ㄥ彲瑙?    // 鑻ユ湰鍦板瓨鍦?legacy "email-user-*" 鏁版嵁锛屽皾璇曡縼绉诲埌瑙勮寖鐨?email-base64 id
    
    const localData = localStore.getUserAll(userId);
    const useLocal = (!userProgress || (Array.isArray(userProgress) && userProgress.length === 0))
      && (localData.userProgress && localData.userProgress.length > 0);

    if (useLocal) {
      return res.json({ success: true, data: localData });
    }

    return res.json({
      success: true,
      data: {
        userProgress: (userProgress as any[]) || [],
        userStats: userStats || null,
        userDailyLogs: (userDailyLogs as any[]) || [],
        userAchievements: (userAchievements as any[]) || []
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

    const existingRows = await prisma.$queryRaw`SELECT * FROM "UserProgress" WHERE "userId" = ${userId} AND "stageId" = ${stageId} LIMIT 1`;
    const existing = (existingRows as any[])[0];
    let resultRows;
    if (existing) {
      resultRows = await prisma.$queryRaw`
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
      resultRows = await prisma.$queryRaw`
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

    // 鎴愬姛鍐欏叆鏁版嵁搴撳悗锛屼篃鍐欏叆鏈湴闄嶇骇瀛樺偍锛屼繚鎸佷袱绔竴鑷?    localStore.upsertStage(userId, { stageId, courseId, bestStars, modes });
    await updateUserStats(userId, bestStars);
    await updateDailyLog(userId, bestStars, modes.includes('type') ? 1 : 0);
    await checkAchievements(userId, bestStars);
    const row = (resultRows as any[])[0] ?? null;
    return res.json({ success: true, data: row ?? resultRows });
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
      const row = (result as any[])[0] ?? null;
      results.push(row ?? result);
    }
    // 鍚屾鎴愬姛鍚庯紝鏇存柊鏈湴闄嶇骇瀛樺偍
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

// POST /progress/reset - 清理当前用户的所有进度与统计（DB + 本地兜底）
router.post('/progress/reset', authenticateToken, async (req, res) => {
  const userId = canonicalUserId(req.user!);
  try {
    const prisma = getPrisma();
    await prisma.$transaction([
      prisma.$executeRaw`DELETE FROM "UserProgress" WHERE "userId" = ${userId}`,
      prisma.$executeRaw`DELETE FROM "UserDailyLog" WHERE "userId" = ${userId}`,
      prisma.$executeRaw`DELETE FROM "UserStats" WHERE "userId" = ${userId}`,
      prisma.$executeRaw`DELETE FROM "UserAchievement" WHERE "userId" = ${userId}`
    ]);
  } catch (error) {
    console.error('Reset progress (DB) failed:', error);
  }

  try {
    localStore.clearUser(userId);
  } catch (error) {
    console.error('Reset progress (local) failed:', error);
  }

  return res.json({ success: true, message: '用户进度已重置' });
});

// GET /stats
router.get('/stats', authenticateToken, async (req, res) => {
  const userId = canonicalUserId(req.user!);
  try {
    const prisma = getPrisma();
    let rows = await prisma.$queryRaw`SELECT * FROM "UserStats" WHERE "userId" = ${userId} LIMIT 1`;
    let row = (rows as any[])[0] ?? null;
    if (!row) {
      rows = await prisma.$queryRaw`
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
      row = (rows as any[])[0] ?? null;
    }
    return res.json({ success: true, data: row ?? rows });
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
    const userStatsRows = await prisma.$queryRaw`
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
    const row = (userStatsRows as any[])[0] ?? null;
    return res.json({ success: true, data: row ?? userStatsRows });
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
      const firstRows = await prisma.$queryRaw`SELECT * FROM "UserAchievement" WHERE "userId" = ${userId} AND "type" = 'first_completion' LIMIT 1`;
      const firstCompletion = (firstRows as any[])[0];
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
      const perfectRows = await prisma.$queryRaw`SELECT * FROM "UserAchievement" WHERE "userId" = ${userId} AND "type" = 'perfect_score' LIMIT 1`;
      const perfectScore = (perfectRows as any[])[0];
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


