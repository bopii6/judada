#!/bin/bash

# 检查已上架歌曲连接的数据库（Shell 版本）

echo "============================================================"
echo "检查已上架歌曲连接的数据库"
echo "============================================================"
echo ""

ENV_FILE="/var/www/judada/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 未找到 .env 文件: $ENV_FILE"
    exit 1
fi

# 1. 显示数据库配置
echo "📋 数据库配置信息:"
echo "------------------------------------------------------------"
echo ""

DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | head -1 | cut -d'=' -f2-)
DIRECT_URL=$(grep "^DIRECT_URL=" "$ENV_FILE" | head -1 | cut -d'=' -f2-)

if [ -z "$DIRECT_URL" ]; then
    DIRECT_URL=$(grep "^#DIRECT_URL=" "$ENV_FILE" | head -1 | sed 's/^#DIRECT_URL=//')
fi

if [ -n "$DATABASE_URL" ]; then
    echo "✅ DATABASE_URL (当前使用):"
    
    # 提取主机和端口
    HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    
    echo "   主机: $HOST"
    echo "   端口: $PORT"
    echo "   数据库: $DB_NAME"
    echo "   用户: $USER"
    
    if [ "$PORT" = "6543" ]; then
        echo "   连接类型: Pooler (连接池)"
    elif [ "$PORT" = "5432" ]; then
        echo "   连接类型: Direct (直接连接)"
    fi
    
    echo "   完整连接字符串: ${DATABASE_URL:0:80}..."
else
    echo "❌ DATABASE_URL: 未设置"
fi

if [ -n "$DIRECT_URL" ]; then
    echo ""
    echo "📝 DIRECT_URL (备用配置):"
    HOST=$(echo "$DIRECT_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    PORT=$(echo "$DIRECT_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo "$DIRECT_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    echo "   主机: $HOST"
    echo "   端口: $PORT"
    echo "   数据库: $DB_NAME"
fi

echo ""
echo "============================================================"
echo "🔍 查询已上架歌曲..."
echo "============================================================"
echo ""

# 2. 使用 Node.js 脚本查询
cd /var/www/judada/apps/server

if [ -f "check-music-database.js" ]; then
    node check-music-database.js
else
    echo "⚠️  未找到 check-music-database.js 脚本"
    echo ""
    echo "可以使用以下命令手动查询:"
    echo ""
    echo "如果安装了 psql:"
    echo "  psql \"$DATABASE_URL\" -c \"SELECT title, title_cn, slug, status FROM \"MusicTrack\" WHERE status = 'published' ORDER BY published_at DESC;\""
    echo ""
    echo "或者使用 Node.js:"
    echo "  cd /var/www/judada/apps/server"
    echo "  node -e \"require('dotenv').config({path:'../../.env'}); const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.musicTrack.findMany({where:{status:'published'}}).then(tracks => {console.log('已上架歌曲:', tracks.length); tracks.forEach(t => console.log('-', t.title)); p.\$disconnect();});\""
fi







