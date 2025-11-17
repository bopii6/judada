#!/bin/bash

echo "🔄 拉取最新代码脚本"
echo "=================="

# 进入项目目录
cd /var/www/judada

# 显示当前状态
echo "📋 当前Git状态:"
git status

echo ""
echo "⬇️  拉取最新代码..."
git pull origin main

# 检查是否有更新
if [ $? -eq 0 ]; then
    echo "✅ 代码拉取成功！"

    echo ""
    echo "📦 更新依赖..."
    pnpm install

    echo ""
    echo "🗄️ 生成Prisma客户端..."
    pnpm db:generate

    echo ""
    echo "🏗️ 重新构建项目..."
    pnpm build

    echo ""
    echo "🔄 重启服务..."
    pm2 restart judada-server
    systemctl restart nginx

    echo ""
    echo "✅ 更新完成！"
    echo "🔍 检查服务状态:"
    pm2 status
    systemctl status nginx --no-pager

    echo ""
    echo "🌐 测试网站访问:"
    echo "主站: curl http://localhost/"
    echo "API: curl http://localhost/api/health"

else
    echo "❌ 代码拉取失败！"
    echo "请检查网络连接或仓库权限"
fi