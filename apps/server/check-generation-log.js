#!/usr/bin/env node

/**
 * 检查最新生成任务的详细日志
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkGenerationLog() {
  try {
    console.log('🔍 检查最新生成任务日志...\n');

    // 查找最新的生成任务
    const latestJob = await prisma.generationJob.findFirst({
      where: {
        jobType: 'package_generation'
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        package: {
          select: {
            title: true
          }
        }
      }
    });

    if (!latestJob) {
      console.log('❌ 没有找到生成任务');
      return;
    }

    console.log(`📦 课程包: ${latestJob.package?.title || '未知'}`);
    console.log(`   任务ID: ${latestJob.id}`);
    console.log(`   状态: ${latestJob.status}`);
    console.log(`   进度: ${latestJob.progress}%`);
    console.log(`   创建时间: ${latestJob.createdAt}`);
    console.log(`   完成时间: ${latestJob.completedAt || '未完成'}`);
    if (latestJob.errorMessage) {
      console.log(`   错误: ${latestJob.errorMessage}`);
    }
    console.log('');

    // 查找日志（如果有日志表）
    // 注意：这里假设有日志表，如果没有可能需要从其他地方获取
    
    // 检查生成的结果
    if (latestJob.result) {
      console.log('📋 生成结果:');
      console.log(JSON.stringify(latestJob.result, null, 2));
      console.log('');
    }

    // 检查inputInfo中的OCR文本
    if (latestJob.inputInfo) {
      const inputInfo = latestJob.inputInfo as any;
      if (inputInfo.assets && Array.isArray(inputInfo.assets)) {
        console.log(`📁 上传的文件数量: ${inputInfo.assets.length}`);
      }
    }

    // 检查生成的版本和关卡
    if (latestJob.packageVersionId) {
      const version = await prisma.coursePackageVersion.findUnique({
        where: { id: latestJob.packageVersionId },
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
          }
        }
      });

      if (version) {
        console.log(`\n📝 生成的版本: ${version.label || `#${version.versionNumber}`}`);
        console.log(`   关卡数量: ${version.lessons.length}`);
        console.log(`   状态: ${version.status}`);
        
        if (version.payload) {
          const plan = version.payload as any;
          if (plan.lessons && plan.lessons.length > 0) {
            console.log(`\n   第一个关卡示例:`);
            const firstLesson = plan.lessons[0];
            console.log(`   标题: ${firstLesson.title}`);
            if (firstLesson.items && firstLesson.items.length > 0) {
              const firstItem = firstLesson.items[0];
              console.log(`   Item类型: ${firstItem.type}`);
              console.log(`   Payload:`);
              console.log(JSON.stringify(firstItem.payload, null, 2));
            }
          }
        }

        console.log(`\n   数据库中的实际关卡:`);
        for (const lesson of version.lessons.slice(0, 3)) {
          const firstItem = lesson.currentVersion?.items[0];
          if (firstItem) {
            const payload = firstItem.payload || {};
            console.log(`   关卡 #${lesson.sequence}: "${lesson.title}"`);
            console.log(`      Item类型: ${firstItem.type}`);
            console.log(`      Payload: ${JSON.stringify(payload)}`);
            const en = payload.en || payload.target || payload.answer || '';
            console.log(`      提取的en: "${en}"`);
            console.log('');
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGenerationLog();


