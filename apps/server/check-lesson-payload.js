#!/usr/bin/env node

/**
 * 检查课程包中关卡payload的数据结构
 * 用于诊断为什么显示中文而不是英文
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkLessonPayloads() {
  try {
    console.log('🔍 开始检查课程包数据...\n');

    // 查找所有已发布的课程包
    const packages = await prisma.coursePackage.findMany({
      where: {
        status: 'published',
        deletedAt: null
      },
      include: {
        currentVersion: {
          include: {
            lessons: {
              where: { deletedAt: null },
              orderBy: { sequence: 'asc' },
              take: 3, // 只检查前3个关卡
              include: {
                currentVersion: {
                  include: {
                    items: {
                      orderBy: { orderIndex: 'asc' },
                      take: 1 // 只检查第一个item
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (packages.length === 0) {
      console.log('❌ 没有找到已发布的课程包');
      return;
    }

    for (const pkg of packages) {
      console.log(`\n📦 课程包: ${pkg.title} (${pkg.id})`);
      console.log(`   状态: ${pkg.status}`);
      console.log(`   当前版本: ${pkg.currentVersion?.id || '无'}`);

      if (!pkg.currentVersion || !pkg.currentVersion.lessons.length) {
        console.log('   ⚠️  没有关卡数据');
        continue;
      }

      console.log(`\n   关卡数量: ${pkg.currentVersion.lessons.length}`);
      console.log(`   检查前3个关卡的payload结构:\n`);

      for (const lesson of pkg.currentVersion.lessons) {
        const firstItem = lesson.currentVersion?.items[0];
        if (!firstItem) {
          console.log(`   ❌ 关卡 #${lesson.sequence} "${lesson.title}" - 没有item`);
          continue;
        }

        const payload = firstItem.payload || {};
        const payloadKeys = Object.keys(payload);

        console.log(`   📝 关卡 #${lesson.sequence}: "${lesson.title}"`);
        console.log(`      类型: ${firstItem.type}`);
        console.log(`      Payload字段: ${payloadKeys.join(', ') || '无'}`);

        // 检查各个可能的英文字段
        const enFields = {
          'en': payload.en,
          'target': payload.target,
          'answer': payload.answer,
          'enText': payload.enText,
          'text': payload.text,
          'sentence': payload.sentence
        };

        const cnFields = {
          'cn': payload.cn,
          'prompt': payload.prompt
        };

        console.log(`      英文字段检查:`);
        let hasEn = false;
        for (const [key, value] of Object.entries(enFields)) {
          if (value) {
            console.log(`        ✅ ${key}: "${String(value).substring(0, 50)}${String(value).length > 50 ? '...' : ''}"`);
            hasEn = true;
          }
        }
        if (!hasEn) {
          console.log(`        ❌ 没有找到任何英文字段！`);
        }

        console.log(`      中文字段检查:`);
        let hasCn = false;
        for (const [key, value] of Object.entries(cnFields)) {
          if (value) {
            console.log(`        📌 ${key}: "${String(value).substring(0, 50)}${String(value).length > 50 ? '...' : ''}"`);
            hasCn = true;
          }
        }
        if (!hasCn) {
          console.log(`        ⚠️  没有找到中文字段`);
        }

        // 显示完整payload（前200字符）
        const payloadStr = JSON.stringify(payload, null, 2);
        console.log(`      完整payload预览:`);
        console.log(`      ${payloadStr.substring(0, 200)}${payloadStr.length > 200 ? '...' : ''}`);
        console.log('');
      }
    }

    console.log('\n✅ 检查完成！');
    console.log('\n💡 如果看到"没有找到任何英文字段"，说明数据是旧的，需要重新生成课程包。');

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLessonPayloads();














