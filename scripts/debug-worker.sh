#!/bin/bash
# Worker调试脚本
# 用于直接运行Worker进程查看详细的上传错误日志

echo "🔍 Jude English Lab Worker 调试..."
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

echo "✅ 当前目录：$(pwd)"
echo "✅ 环境变量文件存在"

# 显示相关环境变量（隐藏敏感信息）
echo ""
echo "🔧 环境变量检查："
echo "--- Redis配置 ---"
echo "REDIS_URL: $(grep REDIS_URL .env | cut -d'=' -f1 | cut -c1-15)..."
echo "QUEUE_PREFIX: $(grep QUEUE_PREFIX .env | cut -d'=' -f1 | cut -c1-15)..."
echo ""
echo "--- API配置 ---"
echo "OPENAI_API_KEY: $(grep OPENAI_API_KEY .env | cut -d'=' -f1 | cut -c1-15)..."
echo "ALIYUN_OCR_ACCESS_KEY_ID: $(grep ALIYUN_OCR_ACCESS_KEY_ID .env | cut -d'=' -f1 | cut -c1-20)..."
echo ""

# 检查依赖是否安装
echo "📦 检查依赖："
if command -v pnpm &> /dev/null; then
    echo "✅ pnpm 已安装"
else
    echo "❌ pnpm 未安装"
    exit 1
fi

# 检查Worker文件是否存在
echo ""
echo "📄 检查Worker文件："
if [ -f "apps/server/src/workers/packageGeneration.worker.ts" ]; then
    echo "✅ Worker源文件存在"
else
    echo "❌ Worker源文件不存在"
    exit 1
fi

if [ -f "apps/server/dist/workers/packageGeneration.worker.js" ]; then
    echo "✅ Worker编译文件存在"
    WORKER_FILE="apps/server/dist/workers/packageGeneration.worker.js"
    WORKER_CMD="pnpm --filter server worker:start"
else
    echo "⚠️  Worker编译文件不存在，将使用源文件运行"
    WORKER_FILE="apps/server/src/workers/packageGeneration.worker.ts"
    WORKER_CMD="pnpm --filter server worker"
fi

echo ""
echo "🚀 启动Worker进程进行调试..."
echo "=================================="
echo "📝 使用命令: $WORKER_CMD"
echo "🔍 这将显示详细的上传、OCR和OpenAI处理日志"
echo "⚠️  注意：这是调试模式，生产环境请使用PM2"
echo ""
echo "💡 提示："
echo "1. 保持此终端运行"
echo "2. 在另一个终端运行: tail -f /var/log/nginx/access.log"
echo "3. 在浏览器中尝试上传素材"
echo "4. 观察此终端中的详细错误信息"
echo ""
echo "按任意键开始调试Worker，或按 Ctrl+C 退出..."
read -n 1

# 启动Worker
echo "启动Worker: $WORKER_CMD"
$WORKER_CMD