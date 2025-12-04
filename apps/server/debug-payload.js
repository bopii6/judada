const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugPayload() {
  try {
    // 查找最新的课程包版本
    const version = await prisma.coursePackageVersion.findFirst({
      where: { 
        packageId: '518d7c59-75f6-4b5f-851a-be0636577739',
        status: 'draft'
      },
      orderBy: { createdAt: 'desc' },
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

    if (!version) {
      console.log('没有找到版本');
      return;
    }

    console.log('版本ID:', version.id);
    console.log('关卡数量:', version.lessons.length);
    console.log('');

    for (const lesson of version.lessons) {
      console.log(`关卡 #${lesson.sequence}: ${lesson.title}`);
      const item = lesson.currentVersion?.items[0];
      if (item) {
        console.log('  Item类型:', item.type);
        console.log('  Payload:', JSON.stringify(item.payload, null, 2));
        const p = item.payload || {};
        console.log('  en:', p.en);
        console.log('  target:', p.target);
        console.log('  answer:', p.answer);
      } else {
        console.log('  没有item');
      }
      console.log('');
    }

    // 检查任务日志
    const job = await prisma.generationJob.findFirst({
      where: { packageId: '518d7c59-75f6-4b5f-851a-be0636577739' },
      orderBy: { createdAt: 'desc' },
      include: {
        logs: {
          orderBy: { createdAt: 'asc' },
          take: 20
        }
      }
    });

    if (job) {
      console.log('\n--- 任务日志 ---');
      for (const log of job.logs) {
        console.log(`[${log.level}] ${log.message}`);
        if (log.details) {
          console.log('  详情:', JSON.stringify(log.details).substring(0, 200));
        }
      }
    }

  } catch (error) {
    console.error('错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPayload();














