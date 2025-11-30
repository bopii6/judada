#!/bin/bash

# 快速检查数据库配置脚本

echo "============================================================"
echo "快速检查 DATABASE_URL 配置"
echo "============================================================"
echo ""

# 检查项目根目录的 .env 文件
ROOT_ENV="/var/www/judada/.env"
SERVER_ENV="/var/www/judada/apps/server/.env"

echo "📄 检查 .env 文件中的 DATABASE_URL..."
echo ""

if [ -f "$ROOT_ENV" ]; then
    echo "✓ 找到: $ROOT_ENV"
    echo ""
    echo "所有 DATABASE_URL 配置:"
    grep -n "^DATABASE_URL=" "$ROOT_ENV" | while IFS=: read -r line_num line_content; do
        value="${line_content#DATABASE_URL=}"
        echo "   行 $line_num: ${value:0:60}..."
    done
    
    # 统计数量
    COUNT=$(grep -c "^DATABASE_URL=" "$ROOT_ENV" 2>/dev/null || echo "0")
    echo ""
    if [ "$COUNT" -gt 1 ]; then
        echo "⚠️  警告: 发现 $COUNT 个 DATABASE_URL 定义！"
        echo "   只有最后一个会生效（会被 dotenv 覆盖）"
        echo ""
        echo "最后一个 DATABASE_URL (会生效的):"
        grep "^DATABASE_URL=" "$ROOT_ENV" | tail -1 | sed 's/^DATABASE_URL=//' | head -c 80
        echo "..."
    else
        echo "✓ 只有一个 DATABASE_URL 定义"
    fi
else
    echo "❌ 未找到: $ROOT_ENV"
fi

if [ -f "$SERVER_ENV" ]; then
    echo ""
    echo "✓ 找到: $SERVER_ENV"
    echo ""
    echo "所有 DATABASE_URL 配置:"
    grep -n "^DATABASE_URL=" "$SERVER_ENV" | while IFS=: read -r line_num line_content; do
        value="${line_content#DATABASE_URL=}"
        echo "   行 $line_num: ${value:0:60}..."
    done
fi

echo ""
echo "============================================================"
echo "💡 代码加载顺序:"
echo "============================================================"
echo ""
echo "应用会按以下顺序加载 .env 文件:"
echo "  1. /var/www/judada/apps/server/.env"
echo "  2. /var/www/judada/.env (会覆盖第一个)"
echo ""
echo "如果同一个文件中有多个 DATABASE_URL，最后一个会生效"
echo ""
echo "============================================================"
echo "🔍 查看实际生效的配置:"
echo "============================================================"
echo ""
echo "运行完整诊断: bash /var/www/judada/apps/server/check-db-config.sh"
echo "查看 PM2 日志: pm2 logs judada-server --lines 50"
echo ""







