#!/usr/bin/env node

/**
 * 检查最新生成的课程包payload结构
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkLatestPayload() {
  try {
    console.log('🔍 检查最新生成的课程包...\n');

    // 查找最新创建的课程包版本
    const latestVersion = await prisma.coursePackageVersion.findFirst({
      where: {
        sourceType: 'ai_generated',
        status: 'draft'
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        lessons: {
          where: { deletedAt: null },
          orderBy: { sequence: 'asc' },
          take: 3,
          include: {
            currentVersion: {
              include: {
                items: {
                  orderBy: { orderIndex: 'asc' },
                  take: 1
                }
              }
            }
          }
        },
        package: {
          select: {
            title: true
          }
        }
      }
    });

    if (!latestVersion) {
      console.log('❌ 没有找到最新生成的课程包版本');
      return;
    }

    console.log(`📦 课程包: ${latestVersion.package.title}`);
    console.log(`   版本: ${latestVersion.label || `#${latestVersion.versionNumber}`}`);
    console.log(`   创建时间: ${latestVersion.createdAt}`);
    console.log(`   关卡数量: ${latestVersion.lessons.length}\n`);

    // 检查payload中的实际内容
    for (const lesson of latestVersion.lessons) {
      const firstItem = lesson.currentVersion?.items[0];
      if (!firstItem) {
        console.log(`   ❌ 关卡 #${lesson.sequence} "${lesson.title}" - 没有item`);
        continue;
      }

      const payload = firstItem.payload || {};
      console.log(`   📝 关卡 #${lesson.sequence}: "${lesson.title}"`);
      console.log(`      类型: ${firstItem.type}`);
      console.log(`      Payload完整内容:`);
      console.log(JSON.stringify(payload, null, 2));
      console.log('');

      // 检查各个字段
      const en = payload.en || payload.target || payload.answer || payload.enText || payload.text || payload.sentence || '';
      const cn = payload.cn || payload.prompt || '';
      
      console.log(`      提取的en字段: "${en}"`);
      console.log(`      提取的cn字段: "${cn}"`);
      console.log(`      是否有英文: ${en ? '✅ 是' : '❌ 否'}`);
      console.log('');
    }

    // 检查版本payload（AI生成的原始数据）
    if (latestVersion.payload) {
      console.log('\n📋 AI生成的原始plan结构:');
      const plan = latestVersion.payload as any;
      if (plan.lessons && plan.lessons.length > 0) {
        const firstLesson = plan.lessons[0];
        console.log(`   第一个关卡标题: ${firstLesson.title}`);
        if (firstLesson.items && firstLesson.items.length > 0) {
          const firstItem = firstLesson.items[0];
          console.log(`   第一个item类型: ${firstItem.type}`);
          console.log(`   第一个item payload:`);
          console.log(JSON.stringify(firstItem.payload, null, 2));
        }
      }
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestPayload();



