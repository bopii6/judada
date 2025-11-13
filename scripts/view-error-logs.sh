#!/bin/bash
# 查看详细错误日志脚本
# 从数据库中读取GenerationJob的详细日志

echo "🔍 Jude English Lab 错误日志查询..."
echo "=================================="

# 检查当前目录
if [ ! -d "/var/www/judada/current" ]; then
    echo "❌ 错误：请确保在 /var/www/judada/current 目录下运行此脚本"
    exit 1
fi

cd /var/www/judada/current

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "❌ 错误：找不到 .env 文件"
    exit 1
fi

# 检查pnpm是否可用
if ! command -v pnpm &> /dev/null; then
    echo "❌ 错误：pnpm 未安装"
    exit 1
fi

echo "✅ 正在查询数据库中的错误日志..."
echo ""

# 使用pnpm执行数据库查询
echo "📋 最近失败的任务详情："
echo "=================================="

# 创建临时的TypeScript脚本来查询数据库
cat > temp_error_query.ts << 'EOF'
import { getPrisma } from "./apps/server/src/lib/prisma";

const prisma = getPrisma();

async function queryErrorLogs() {
  try {
    // 查询最近5个失败的任务
    const failedJobs = await prisma.generationJob.findMany({
      where: {
        status: 'failed'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      include: {
        package: {
          select: {
            name: true
          }
        }
      }
    });

    if (failedJobs.length === 0) {
      console.log("✅ 没有找到失败的任务");
      return;
    }

    for (const job of failedJobs) {
      console.log(`\n🚨 失败任务 ID: ${job.id}`);
      console.log(`📦 课程包: ${job.package?.name || '未知'}`);
      console.log(`📅 创建时间: ${job.createdAt.toISOString()}`);
      console.log(`⏱️  开始时间: ${job.startedAt?.toISOString() || '未开始'}`);
      console.log(`📊 进度: ${job.progress || 0}%`);
      console.log(`🔄 状态: ${job.status}`);
      console.log(`❌ 错误信息: ${job.errorMessage || '无错误信息'}`);
      console.log(`📝 输入信息:`);
      console.log(JSON.stringify(job.inputInfo, null, 2));

      // 查询该任务的所有日志
      const logs = await prisma.generationJobLog.findMany({
        where: {
          generationJobId: job.id
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      if (logs.length > 0) {
        console.log(`\n📜 详细日志 (${logs.length}条):`);
        console.log("================================");
        for (const log of logs) {
          const timestamp = log.createdAt.toISOString();
          const level = log.level.toUpperCase().padEnd(5);
          const message = log.message || '无消息';
          console.log(`[${timestamp}] ${level} ${message}`);
          if (log.metadata) {
            try {
              console.log(`  元数据: ${JSON.stringify(log.metadata, null, 4)}`);
            } catch (e) {
              console.log(`  元数据: [无法解析]`);
            }
          }
          console.log("");
        }
      } else {
        console.log("\n📜 该任务没有详细日志记录");
      }

      console.log("=========================================");
    }

  } catch (error) {
    console.error("❌ 查询失败:", error);
  } finally {
    await prisma.$disconnect();
  }
}

queryErrorLogs();
EOF

# 执行查询脚本
echo "正在执行数据库查询..."
pnpx tsx temp_error_query.ts

# 清理临时文件
rm -f temp_error_query.ts

echo ""
echo "💡 其他有用的查询命令："
echo "1. 查看所有任务状态: pnpm db:query 'SELECT status, COUNT(*) FROM GenerationJob GROUP BY status'"
echo "2. 查看最近任务: pnpm db:query 'SELECT id, status, errorMessage FROM GenerationJob ORDER BY createdAt DESC LIMIT 10'"
echo "3. 重置失败任务: pnpm db:query 'UPDATE GenerationJob SET status = \"pending\" WHERE status = \"failed\"'"