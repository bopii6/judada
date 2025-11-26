#!/bin/bash

# 数据库配置检查脚本（Linux 版本）
# 用于检查哪个 DATABASE_URL 在生效

echo "============================================================"
echo "数据库配置诊断工具"
echo "============================================================"
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV_FILE="$SCRIPT_DIR/.env"
ROOT_ENV_FILE="$(dirname "$SCRIPT_DIR")/.env"

# 1. 检查 .env 文件
echo "📄 检查 .env 文件..."
echo "------------------------------------------------------------"

if [ -f "$ENV_FILE" ]; then
    echo "✓ 找到: $ENV_FILE"
    ENV_FILE_TO_CHECK="$ENV_FILE"
elif [ -f "$ROOT_ENV_FILE" ]; then
    echo "✓ 找到: $ROOT_ENV_FILE"
    ENV_FILE_TO_CHECK="$ROOT_ENV_FILE"
else
    echo "❌ 未找到 .env 文件"
    echo "   检查路径: $ENV_FILE"
    echo "   检查路径: $ROOT_ENV_FILE"
    ENV_FILE_TO_CHECK=""
fi

if [ -n "$ENV_FILE_TO_CHECK" ]; then
    DATABASE_URL_COUNT=0
    DIRECT_URL_FOUND=0
    LINE_NUM=0
    
    while IFS= read -r line; do
        LINE_NUM=$((LINE_NUM + 1))
        # 去除首尾空格
        trimmed=$(echo "$line" | xargs)
        
        # 跳过空行和注释
        if [ -z "$trimmed" ] || [[ "$trimmed" == \#* ]]; then
            continue
        fi
        
        # 检查 DATABASE_URL
        if [[ "$trimmed" == DATABASE_URL=* ]]; then
            DATABASE_URL_COUNT=$((DATABASE_URL_COUNT + 1))
            value="${trimmed#DATABASE_URL=}"
            echo ""
            echo "🔍 发现第 $DATABASE_URL_COUNT 个 DATABASE_URL (行 $LINE_NUM):"
            echo "   ${value:0:80}..."
        fi
        
        # 检查 DIRECT_URL
        if [[ "$trimmed" == DIRECT_URL=* ]]; then
            DIRECT_URL_FOUND=1
            value="${trimmed#DIRECT_URL=}"
            echo ""
            echo "🔍 发现 DIRECT_URL (行 $LINE_NUM):"
            echo "   ${value:0:80}..."
        fi
    done < "$ENV_FILE_TO_CHECK"
    
    echo ""
    echo "------------------------------------------------------------"
    echo ""
    echo "📊 统计:"
    echo "   - DATABASE_URL 出现次数: $DATABASE_URL_COUNT"
    echo "   - DIRECT_URL 出现次数: $DIRECT_URL_FOUND"
    
    if [ "$DATABASE_URL_COUNT" -gt 1 ]; then
        echo ""
        echo "⚠️  警告: .env 文件中存在 $DATABASE_URL_COUNT 个 DATABASE_URL 定义！"
        echo "   通常只有最后一个会生效（取决于环境变量加载顺序）"
    fi
fi

echo ""
echo "============================================================"
echo "🔧 当前进程环境变量:"
echo "============================================================"
echo ""

# 2. 检查当前 shell 环境变量
if [ -n "$DATABASE_URL" ]; then
    echo "✅ DATABASE_URL (当前 shell 环境变量):"
    echo "   ${DATABASE_URL:0:80}..."
    echo "   完整值: $DATABASE_URL"
else
    echo "❌ DATABASE_URL: 未设置（当前 shell 中）"
fi

if [ -n "$DIRECT_URL" ]; then
    echo ""
    echo "✅ DIRECT_URL (当前 shell 环境变量):"
    echo "   ${DIRECT_URL:0:80}..."
    echo "   完整值: $DIRECT_URL"
else
    echo ""
    echo "❌ DIRECT_URL: 未设置（当前 shell 中）"
fi

echo ""
echo "============================================================"
echo "💡 代码使用情况:"
echo "============================================================"
echo ""

# 3. 检查代码中的使用
PRISMA_FILE="$SCRIPT_DIR/src/lib/prisma.ts"
if [ -f "$PRISMA_FILE" ]; then
    echo "📝 apps/server/src/lib/prisma.ts:"
    if grep -q "process.env.DATABASE_URL" "$PRISMA_FILE"; then
        echo "   ✓ 使用 process.env.DATABASE_URL"
        echo "   ⚠️  这是 Prisma 实际使用的数据库连接！"
    fi
    if grep -q "process.env.DIRECT_URL" "$PRISMA_FILE"; then
        echo "   ✓ 使用 process.env.DIRECT_URL"
    else
        echo "   ✗ 未使用 DIRECT_URL"
    fi
fi

ENV_CONFIG_FILE="$SCRIPT_DIR/src/config/env.ts"
if [ -f "$ENV_CONFIG_FILE" ]; then
    echo ""
    echo "📝 apps/server/src/config/env.ts:"
    if grep -q "DATABASE_URL" "$ENV_CONFIG_FILE"; then
        echo "   ✓ 验证 DATABASE_URL（必需）"
    fi
    if grep -q "DIRECT_URL" "$ENV_CONFIG_FILE"; then
        echo "   ✓ 验证 DIRECT_URL"
    else
        echo "   ✗ 未验证 DIRECT_URL（代码中未使用）"
    fi
fi

echo ""
echo "============================================================"
echo "🧪 测试环境变量加载:"
echo "============================================================"
echo ""

# 4. 测试从 .env 文件加载
if [ -n "$ENV_FILE_TO_CHECK" ]; then
    echo "尝试从 .env 文件加载环境变量..."
    
    # 使用 source 加载 .env（模拟应用加载方式）
    set -a
    source "$ENV_FILE_TO_CHECK" 2>/dev/null || {
        # 如果 source 失败，尝试手动解析
        while IFS= read -r line; do
            trimmed=$(echo "$line" | xargs)
            if [ -n "$trimmed" ] && [[ ! "$trimmed" == \#* ]] && [[ "$trimmed" == *"="* ]]; then
                export "$trimmed" 2>/dev/null
            fi
        done < "$ENV_FILE_TO_CHECK"
    }
    set +a
    
    echo ""
    if [ -n "$DATABASE_URL" ]; then
        echo "✅ 加载后 DATABASE_URL:"
        echo "   ${DATABASE_URL:0:80}..."
        echo "   完整值: $DATABASE_URL"
    else
        echo "❌ 加载后 DATABASE_URL: 仍未设置"
    fi
fi

echo ""
echo "============================================================"
echo "🔍 检查 PM2 进程环境变量:"
echo "============================================================"
echo ""

# 5. 检查 PM2 进程
if command -v pm2 >/dev/null 2>&1; then
    PM2_PROCESS=$(pm2 jlist 2>/dev/null | grep -o '"name":"judada-server"' 2>/dev/null)
    if [ -n "$PM2_PROCESS" ]; then
        echo "✓ 找到 PM2 进程: judada-server"
        echo ""
        echo "PM2 进程环境变量中的 DATABASE_URL:"
        pm2 show judada-server 2>/dev/null | grep -A 20 "env:" | grep "DATABASE_URL" || echo "   (未在 PM2 配置中找到 DATABASE_URL)"
        echo ""
        echo "💡 提示: PM2 进程的环境变量可能来自:"
        echo "   1. PM2 ecosystem.config.js 中的 env 配置"
        echo "   2. 应用启动时从 .env 文件加载（通过 dotenv）"
        echo "   3. 系统环境变量"
    else
        echo "⚠️  未找到 judada-server PM2 进程"
        echo "   运行 'pm2 list' 查看所有进程"
    fi
else
    echo "⚠️  PM2 未安装或不在 PATH 中"
fi

echo ""
echo "============================================================"
echo "📋 重要说明:"
echo "============================================================"
echo ""
echo "🔑 关键发现:"
echo "   - 代码从以下位置加载 .env 文件:"
echo "     1. apps/server/.env"
echo "     2. 项目根目录/.env (../../.env)"
echo "   - 如果两个文件都存在，后面的会覆盖前面的"
echo "   - 如果同一个文件中有多个 DATABASE_URL，最后一个会生效"
echo ""
echo "💡 如何确定实际使用的配置:"
echo "   1. 检查 .env 文件中最后一个 DATABASE_URL"
echo "   2. 查看应用启动日志（会显示加载的 .env 路径）"
echo "   3. 检查 PM2 日志: pm2 logs judada-server"
echo ""
echo "📝 建议操作:"
echo "   1. 如果 .env 文件中有多个 DATABASE_URL，只保留一个"
echo "   2. 确保 .env 文件在正确的位置（项目根目录）"
echo "   3. 重启 PM2 进程使配置生效: pm2 restart judada-server"
echo ""

