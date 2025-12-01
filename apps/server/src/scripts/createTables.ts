import { PrismaClient } from "@prisma/client";

import { getEnv } from "../config/env";

async function createTables() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: getEnv().DATABASE_URL,
      },
    },
  });

  try {
    console.log('开始创建用户进度相关表...');

    // 检查数据库连接
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ 数据库连接成功');

    // 先删除旧表（如果存在）
    try {
      await prisma.$executeRaw`DROP TABLE IF EXISTS "UserProgress" CASCADE;`;
      await prisma.$executeRaw`DROP TABLE IF EXISTS "UserStats" CASCADE;`;
      await prisma.$executeRaw`DROP TABLE IF EXISTS "UserDailyLog" CASCADE;`;
      await prisma.$executeRaw`DROP TABLE IF EXISTS "UserAchievement" CASCADE;`;
      console.log('清理旧表完成');
    } catch (e) {
      console.log('没有旧表需要清理');
    }

    // 创建UserProgress表
    await prisma.$executeRaw`
      CREATE TABLE "UserProgress" (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "stageId" TEXT NOT NULL,
        "courseId" TEXT NOT NULL,
        "bestStars" INTEGER NOT NULL DEFAULT 0,
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "lastPlayedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "modes" TEXT[] NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      );
    `;
    console.log('✅ UserProgress表创建成功');

    // 创建UserStats表
    await prisma.$executeRaw`
      CREATE TABLE "UserStats" (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "totalPlayTime" INTEGER NOT NULL DEFAULT 0,
        "totalStars" INTEGER NOT NULL DEFAULT 0,
        "completedStages" INTEGER NOT NULL DEFAULT 0,
        "currentStreak" INTEGER NOT NULL DEFAULT 0,
        "longestStreak" INTEGER NOT NULL DEFAULT 0,
        "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      );
    `;
    console.log('✅ UserStats表创建成功');

    // 创建UserDailyLog表
    await prisma.$executeRaw`
      CREATE TABLE "UserDailyLog" (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "completedStages" INTEGER NOT NULL DEFAULT 0,
        "starsEarned" INTEGER NOT NULL DEFAULT 0,
        "typingStages" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      );
    `;
    console.log('✅ UserDailyLog表创建成功');

    // 创建UserAchievement表
    await prisma.$executeRaw`
      CREATE TABLE "UserAchievement" (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "data" JSONB,
        "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ UserAchievement表创建成功');

    // 创建索引
    await prisma.$executeRaw`CREATE INDEX "UserProgress_userId_idx" ON "UserProgress"("userId");`;
    await prisma.$executeRaw`CREATE INDEX "UserProgress_courseId_idx" ON "UserProgress"("courseId");`;
    await prisma.$executeRaw`CREATE INDEX "UserDailyLog_userId_idx" ON "UserDailyLog"("userId");`;
    await prisma.$executeRaw`CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");`;
    console.log('✅ 索引创建成功');

    // 创建唯一约束
    await prisma.$executeRaw`ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_stageId_key" UNIQUE ("userId", "stageId");`;
    await prisma.$executeRaw`ALTER TABLE "UserStats" ADD CONSTRAINT "UserStats_userId_key" UNIQUE ("userId");`;
    await prisma.$executeRaw`ALTER TABLE "UserDailyLog" ADD CONSTRAINT "UserDailyLog_userId_date_key" UNIQUE ("userId", "date");`;
    await prisma.$executeRaw`ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_type_key" UNIQUE ("userId", "type");`;
    console.log('✅ 唯一约束创建成功');

    console.log('🎉 所有表创建成功！');
  } catch (error) {
    console.error('❌ 创建表失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createTables();
}

export default createTables;
