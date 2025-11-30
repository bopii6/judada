const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkJobLogs() {
  try {
    // 查找最新的生成任务
    const job = await prisma.generationJob.findFirst({
      where: {
        packageId: '6b998936-7f71-4f5f-ba8f-5db51e6a52c5' // 从终端日志中找到的package ID
      },
      orderBy: { createdAt: 'desc' },
      include: {
        logs: {
          orderBy: { createdAt: 'asc' },
          take: 100 // 查看前100条日志
        },
        package: {
          select: { title: true }
        }
      }
    });

    if (!job) {
      console.log('❌ 没有找到生成任务');
      return;
    }

    console.log(`\n📦 课程包: ${job.package?.title || '未知'}`);
    console.log(`任务ID: ${job.id}`);
    console.log(`状态: ${job.status}`);
    console.log(`创建时间: ${job.createdAt}`);
    console.log(`完成时间: ${job.completedAt || '未完成'}`);
    console.log(`日志数量: ${job.logs.length}\n`);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 详细日志:');
    console.log('═══════════════════════════════════════════════════════════\n');

    for (const log of job.logs) {
      const level = log.level.toUpperCase().padEnd(8);
      const time = new Date(log.createdAt).toLocaleTimeString('zh-CN');
      console.log(`[${time}] [${level}] ${log.message}`);
      
      if (log.details) {
        const details = typeof log.details === 'string' 
          ? JSON.parse(log.details) 
          : log.details;
        
        // 格式化显示details
        const detailsStr = JSON.stringify(details, null, 2);
        if (detailsStr.length < 500) {
          console.log('详情:', detailsStr);
        } else {
          console.log('详情:', detailsStr.substring(0, 500) + '...');
        }
      }
      console.log('');
    }

    // 检查生成的课程包版本
    if (job.packageVersionId) {
      const version = await prisma.coursePackageVersion.findUnique({
        where: { id: job.packageVersionId },
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
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📝 生成的课程数据:');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log(`版本: ${version.label || `#${version.versionNumber}`}`);
        console.log(`关卡数量: ${version.lessons.length}`);
        
        for (const lesson of version.lessons) {
          console.log(`\n关卡 #${lesson.sequence}: ${lesson.title}`);
          const item = lesson.currentVersion?.items[0];
          if (item) {
            console.log(`  Item类型: ${item.type}`);
            console.log(`  Payload:`, JSON.stringify(item.payload, null, 2));
            const p = item.payload || {};
            console.log(`  en字段: "${p.en || '(空)'}"`);
            console.log(`  answer字段: "${p.answer || '(空)'}"`);
            console.log(`  target字段: "${p.target || '(空)'}"`);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkJobLogs();







