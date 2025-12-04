#!/bin/bash

# 数据库连接修复脚本
# 将 pooler 连接切换为直接连接

ENV_FILE="/var/www/judada/.env"
BACKUP_FILE="/var/www/judada/.env.backup.$(date +%Y%m%d_%H%M%S)"

echo "============================================================"
echo "数据库连接修复工具"
echo "============================================================"
echo ""

# 1. 备份 .env 文件
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 未找到 .env 文件: $ENV_FILE"
    exit 1
fi

echo "📋 备份 .env 文件..."
cp "$ENV_FILE" "$BACKUP_FILE"
echo "✅ 备份已保存到: $BACKUP_FILE"
echo ""

# 2. 检查 DIRECT_URL
DIRECT_URL_LINE=$(grep "^#DIRECT_URL=" "$ENV_FILE" | head -1)
DIRECT_URL=$(echo "$DIRECT_URL_LINE" | sed 's/^#DIRECT_URL=//')

if [ -z "$DIRECT_URL" ]; then
    # 尝试查找未注释的 DIRECT_URL
    DIRECT_URL_LINE=$(grep "^DIRECT_URL=" "$ENV_FILE" | head -1)
    DIRECT_URL=$(echo "$DIRECT_URL_LINE" | cut -d'=' -f2-)
fi

if [ -z "$DIRECT_URL" ]; then
    echo "❌ 未找到 DIRECT_URL 配置"
    echo ""
    echo "请手动在 .env 文件中添加 DIRECT_URL，格式:"
    echo "DIRECT_URL=postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres?sslmode=require"
    exit 1
fi

echo "找到 DIRECT_URL:"
echo "   ${DIRECT_URL:0:80}..."
echo ""

# 3. 确认操作
read -p "是否要将 DATABASE_URL 替换为 DIRECT_URL? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "操作已取消"
    exit 0
fi

# 4. 执行替换
echo ""
echo "🔄 更新 DATABASE_URL..."

# 创建临时文件
TEMP_FILE=$(mktemp)

# 处理文件
while IFS= read -r line; do
    if [[ "$line" =~ ^DATABASE_URL= ]]; then
        # 替换 DATABASE_URL
        echo "DATABASE_URL=$DIRECT_URL"
    elif [[ "$line" =~ ^#DIRECT_URL= ]]; then
        # 保持 DIRECT_URL 注释（作为备份）
        echo "$line"
    else
        echo "$line"
    fi
done < "$ENV_FILE" > "$TEMP_FILE"

# 替换原文件
mv "$TEMP_FILE" "$ENV_FILE"

echo "✅ DATABASE_URL 已更新"
echo ""

# 5. 验证新配置
echo "验证新配置..."
NEW_DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | head -1 | cut -d'=' -f2-)
NEW_HOST=$(echo "$NEW_DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
NEW_PORT=$(echo "$NEW_DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

echo "新的 DATABASE_URL:"
echo "   主机: $NEW_HOST"
echo "   端口: $NEW_PORT"
echo ""

# 6. 测试连接（如果可能）
if command -v psql >/dev/null 2>&1; then
    echo "测试新连接..."
    if timeout 10 psql "$NEW_DATABASE_URL" -c "SELECT version();" >/dev/null 2>&1; then
        echo "✅ 连接测试成功！"
    else
        echo "⚠️  连接测试失败，但配置已更新"
        echo "   请检查网络连接和数据库设置"
    fi
else
    echo "⚠️  psql 未安装，跳过连接测试"
fi

echo ""
echo "============================================================"
echo "📋 下一步操作:"
echo "============================================================"
echo ""
echo "1. 重启应用使配置生效:"
echo "   pm2 restart judada-server"
echo ""
echo "2. 查看应用日志:"
echo "   pm2 logs judada-server"
echo ""
echo "3. 如果仍有问题，可以恢复备份:"
echo "   cp $BACKUP_FILE $ENV_FILE"
echo ""














