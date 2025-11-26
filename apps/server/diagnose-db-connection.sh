#!/bin/bash

# 数据库连接诊断和修复脚本

echo "============================================================"
echo "数据库连接诊断工具"
echo "============================================================"
echo ""

# 1. 检查 .env 文件中的 DATABASE_URL
ENV_FILE="/var/www/judada/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 未找到 .env 文件: $ENV_FILE"
    exit 1
fi

echo "📄 检查 .env 文件配置..."
echo ""

# 提取 DATABASE_URL
DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | head -1 | cut -d'=' -f2-)
DIRECT_URL=$(grep "^DIRECT_URL=" "$ENV_FILE" | head -1 | cut -d'=' -f2-)

if [ -z "$DATABASE_URL" ]; then
    echo "❌ 未找到 DATABASE_URL"
    exit 1
fi

echo "当前 DATABASE_URL:"
echo "   ${DATABASE_URL:0:80}..."
echo ""

# 解析连接信息
HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "连接信息:"
echo "   主机: $HOST"
echo "   端口: $PORT"
echo "   数据库: $DB_NAME"
echo ""

# 2. 测试网络连接
echo "============================================================"
echo "🔍 测试网络连接..."
echo "============================================================"
echo ""

echo "测试连接到 $HOST:$PORT ..."

# 检查端口是否可达
if command -v nc >/dev/null 2>&1; then
    if timeout 5 nc -z "$HOST" "$PORT" 2>/dev/null; then
        echo "✅ 端口 $PORT 可达"
    else
        echo "❌ 端口 $PORT 不可达（可能被防火墙阻止或服务未运行）"
    fi
else
    echo "⚠️  nc 命令不可用，跳过端口测试"
fi

# 测试 DNS 解析
echo ""
echo "测试 DNS 解析..."
if host "$HOST" >/dev/null 2>&1 || nslookup "$HOST" >/dev/null 2>&1; then
    echo "✅ DNS 解析成功"
    IP=$(getent hosts "$HOST" | awk '{print $1}' | head -1)
    echo "   IP 地址: $IP"
else
    echo "❌ DNS 解析失败"
fi

# 3. 测试数据库连接（如果安装了 psql）
echo ""
echo "============================================================"
echo "🧪 测试数据库连接..."
echo "============================================================"
echo ""

if command -v psql >/dev/null 2>&1; then
    echo "尝试使用 pooler 连接 (端口 $PORT)..."
    if timeout 10 psql "$DATABASE_URL" -c "SELECT version();" >/dev/null 2>&1; then
        echo "✅ Pooler 连接成功！"
    else
        echo "❌ Pooler 连接失败"
        
        # 尝试直接连接
        if [ -n "$DIRECT_URL" ]; then
            echo ""
            echo "尝试使用 DIRECT_URL (直接连接)..."
            DIRECT_HOST=$(echo "$DIRECT_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
            DIRECT_PORT=$(echo "$DIRECT_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
            echo "   主机: $DIRECT_HOST"
            echo "   端口: $DIRECT_PORT"
            
            if timeout 10 psql "$DIRECT_URL" -c "SELECT version();" >/dev/null 2>&1; then
                echo "✅ 直接连接成功！"
                echo ""
                echo "💡 建议: 使用 DIRECT_URL 替代 DATABASE_URL"
            else
                echo "❌ 直接连接也失败"
            fi
        fi
    fi
else
    echo "⚠️  psql 未安装，跳过数据库连接测试"
    echo "   可以安装: yum install postgresql -y 或 apt-get install postgresql-client -y"
fi

# 4. 检查防火墙
echo ""
echo "============================================================"
echo "🔥 检查防火墙设置..."
echo "============================================================"
echo ""

if command -v firewall-cmd >/dev/null 2>&1; then
    echo "检查 firewalld..."
    firewall-cmd --list-all 2>/dev/null | grep -q "$PORT" && echo "✅ 端口 $PORT 在防火墙规则中" || echo "⚠️  端口 $PORT 可能未在防火墙规则中"
elif command -v ufw >/dev/null 2>&1; then
    echo "检查 ufw..."
    ufw status | grep -q "$PORT" && echo "✅ 端口 $PORT 在防火墙规则中" || echo "⚠️  端口 $PORT 可能未在防火墙规则中"
elif command -v iptables >/dev/null 2>&1; then
    echo "检查 iptables..."
    iptables -L -n | grep -q "$PORT" && echo "✅ 端口 $PORT 在防火墙规则中" || echo "⚠️  端口 $PORT 可能未在防火墙规则中"
fi

# 5. 提供修复建议
echo ""
echo "============================================================"
echo "💡 修复建议:"
echo "============================================================"
echo ""
echo "1. 如果 pooler 连接失败，尝试使用直接连接:"
echo "   - 取消注释 DIRECT_URL"
echo "   - 将 DATABASE_URL 替换为 DIRECT_URL 的值"
echo ""
echo "2. 检查 Supabase 项目设置:"
echo "   - 确认数据库是否运行"
echo "   - 检查连接池设置"
echo "   - 验证 IP 白名单（如果需要）"
echo ""
echo "3. 检查服务器网络:"
echo "   - 确认服务器可以访问外网"
echo "   - 检查是否有代理设置"
echo "   - 验证 DNS 解析"
echo ""
echo "4. 临时测试: 在服务器上运行:"
echo "   psql \"$DATABASE_URL\" -c \"SELECT 1;\""
echo ""

