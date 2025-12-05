#!/bin/bash

# 切换到直接连接的脚本

ENV_FILE="/var/www/judada/.env"
BACKUP_FILE="/var/www/judada/.env.backup.$(date +%Y%m%d_%H%M%S)"

echo "============================================================"
echo "切换到直接连接 (Direct Connection)"
echo "============================================================"
echo ""

# 1. 备份
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 未找到 .env 文件: $ENV_FILE"
    exit 1
fi

echo "📋 备份 .env 文件..."
cp "$ENV_FILE" "$BACKUP_FILE"
echo "✅ 备份已保存到: $BACKUP_FILE"
echo ""

# 2. 查找 DIRECT_URL
DIRECT_URL=""
DIRECT_URL_LINE=$(grep "^#DIRECT_URL=" "$ENV_FILE" | head -1)

if [ -n "$DIRECT_URL_LINE" ]; then
    DIRECT_URL=$(echo "$DIRECT_URL_LINE" | sed 's/^#DIRECT_URL=//')
    echo "✓ 找到被注释的 DIRECT_URL"
elif grep -q "^DIRECT_URL=" "$ENV_FILE"; then
    DIRECT_URL=$(grep "^DIRECT_URL=" "$ENV_FILE" | head -1 | cut -d'=' -f2-)
    echo "✓ 找到 DIRECT_URL"
fi

# 3. 如果没有 DIRECT_URL，根据当前 DATABASE_URL 生成
if [ -z "$DIRECT_URL" ]; then
    CURRENT_DB_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | head -1 | cut -d'=' -f2-)
    
    # 从 pooler URL 生成 direct URL
    if echo "$CURRENT_DB_URL" | grep -q "pooler.supabase.com:6543"; then
        # 提取密码
        PASSWORD=$(echo "$CURRENT_DB_URL" | sed -n 's/.*:\([^@]*\)@.*/\1/p')
        # 提取项目 ID
        PROJECT_ID=$(echo "$CURRENT_DB_URL" | sed -n 's/.*postgres\.\([^:]*\):.*/\1/p')
        
        if [ -n "$PASSWORD" ] && [ -n "$PROJECT_ID" ]; then
            DIRECT_URL="postgresql://postgres:${PASSWORD}@db.${PROJECT_ID}.supabase.co:5432/postgres?sslmode=require"
            echo "✓ 根据当前配置生成 DIRECT_URL"
        fi
    fi
fi

if [ -z "$DIRECT_URL" ]; then
    echo "❌ 无法找到或生成 DIRECT_URL"
    echo ""
    echo "请手动在 .env 文件中添加 DIRECT_URL，格式:"
    echo "DIRECT_URL=postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres?sslmode=require"
    exit 1
fi

echo ""
echo "DIRECT_URL:"
echo "   ${DIRECT_URL:0:80}..."
echo ""

# 4. 更新 DATABASE_URL
echo "🔄 更新 DATABASE_URL 为直接连接..."

# 创建临时文件
TEMP_FILE=$(mktemp)

# 处理文件
while IFS= read -r line; do
    if [[ "$line" =~ ^DATABASE_URL= ]]; then
        # 替换为 DIRECT_URL
        echo "DATABASE_URL=$DIRECT_URL"
    elif [[ "$line" =~ ^#DIRECT_URL= ]]; then
        # 保持注释作为备份
        echo "$line"
    elif [[ "$line" =~ ^DIRECT_URL= ]] && [[ ! "$line" =~ ^#DIRECT_URL= ]]; then
        # 如果 DIRECT_URL 未注释，注释它（作为备份）
        echo "#$line"
    else
        echo "$line"
    fi
done < "$ENV_FILE" > "$TEMP_FILE"

# 替换原文件
mv "$TEMP_FILE" "$ENV_FILE"

echo "✅ DATABASE_URL 已更新为直接连接"
echo ""

# 5. 验证
NEW_DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | head -1 | cut -d'=' -f2-)
NEW_HOST=$(echo "$NEW_DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
NEW_PORT=$(echo "$NEW_DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

echo "新的配置:"
echo "   主机: $NEW_HOST"
echo "   端口: $NEW_PORT"
echo "   连接类型: Direct Connection (直接连接)"
echo ""

# 6. 测试连接（可选）
if command -v psql >/dev/null 2>&1; then
    echo "测试连接..."
    if timeout 10 psql "$NEW_DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ 连接测试成功！"
    else
        echo "⚠️  连接测试失败，但配置已更新"
    fi
fi

echo ""
echo "============================================================"
echo "📋 下一步操作:"
echo "============================================================"
echo ""
echo "1. 重启应用使配置生效:"
echo "   pm2 restart judada-server"
echo ""
echo "2. 查看应用日志确认连接:"
echo "   pm2 logs judada-server --lines 50"
echo ""
echo "3. 如果需要恢复，使用备份文件:"
echo "   cp $BACKUP_FILE $ENV_FILE"
echo ""

















